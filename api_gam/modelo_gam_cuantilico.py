"""GAM cuantílico sin fecha de apertura para valores registrados inmobiliarios.

Ejecutar:
  python modelo_gam_cuantilico.py --datos datos_modelos_enriquecido_nuevo.csv
  python modelo_gam_cuantilico.py --datos datos_modelos_enriquecido_nuevo.csv --mlflow

2015–2021 -> validación 2022; 2015–2022 -> comprobación retrospectiva 2023.
Alpha congelado en 0.01. No selecciona hiperparámetros usando esos dos años.
Cada modelo guardado acepta filas enriquecidas sin monto ni fecha de apertura.
"""
from __future__ import annotations

import os
os.environ.setdefault("OMP_NUM_THREADS", "4")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "4")

import argparse
import hashlib
import importlib.util
import json
import platform
import shutil
import sys
import time
import unicodedata
from contextlib import nullcontext
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import scipy
import sklearn
from scipy.optimize import linprog
from sklearn.base import BaseEstimator, RegressorMixin, TransformerMixin
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import OneHotEncoder, SplineTransformer, StandardScaler
from sklearn.utils.validation import check_is_fitted
from threadpoolctl import threadpool_limits

OBJETIVO = "valor_cop_dic2023"
ALPHA = 0.01  # Misma escala de objetivo y penalización que el candidato evaluado.
IPC_PCT = {2016: 5.75, 2017: 4.09, 2018: 3.18, 2019: 3.80,
           2020: 1.61, 2021: 5.62, 2022: 13.12, 2023: 9.28}
FACTORES = {y: float(np.prod([1 + IPC_PCT[t] / 100 for t in range(y + 1, 2024)]))
            for y in range(2015, 2024)}


def guardar_json(path, value):
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2,
                                    allow_nan=False), encoding="utf-8")


class PrepararVariablesGAM(TransformerMixin, BaseEstimator):
    """Transforma filas originales y aprende solo contexto poblacional pasado.

    No utiliza monto, objetivo, indicador de extremos, llaves, fecha de apertura
    ni valor agregado contemporáneo. La edad de construcción no está disponible.
    """

    def fit(self, X, y=None):
        population = X[["municipio", "year_radica", "poblacion_total"]].drop_duplicates()
        if population.duplicated(["municipio", "year_radica"]).any():
            raise ValueError("Hay población inconsistente para un municipio y año")
        self.poblacion_pasada_ = population.set_index(
            ["municipio", "year_radica"])["poblacion_total"]
        self.max_anio_train_ = int(X.year_radica.max())
        return self

    def transform(self, X):
        check_is_fitted(self, "poblacion_pasada_")
        z = X[["municipio", "year_radica", "poblacion_total", "proporcion_cabecera"]].copy()
        for name, ages in [("0_17", range(18)), ("18_24", range(18, 25))]:
            z["proporcion_" + name] = X[[f"poblacion_edad_{a}" for a in ages]].sum(axis=1) / X.poblacion_total
        z["proporcion_25_44"] = X.proporcion_25_44
        ages65 = [f"poblacion_edad_{a}" for a in range(65, 85)] + ["poblacion_edad_85_mas"]
        z["proporcion_65_mas"] = X[ages65].sum(axis=1) / X.poblacion_total
        z["elic_area_vivienda_nueva_m2_lag1"] = X.elic_area_vivienda_nueva_m2_lag1
        past = {}
        for lag in [1, 2]:
            keys = pd.MultiIndex.from_arrays([X.municipio, X.year_radica - lag])
            past[lag] = self.poblacion_pasada_.reindex(keys).to_numpy()
        z["viviendas_por_1000"] = 1000 * X.elic_unidades_vivienda_nueva_lag1 / past[1]
        # FACTORES es multiplicador a dic-2023, no índice: se multiplica.
        z["va_real_pc"] = X.va_total_lag2 * 1e9 * (X.year_radica - 2).map(FACTORES) / past[2]
        for col in ["va_proporcion_secundaria_lag2", "va_proporcion_terciaria_lag2"]:
            z[col] = X[col]
        for col in ["poblacion_total", "elic_area_vivienda_nueva_m2_lag1",
                    "viviendas_por_1000", "va_real_pc"]:
            z[col] = np.log1p(z[col])
        for col in ["crecimiento_poblacion", "crecimiento_poblacion_cambio_serie",
                    "elic_en_cobertura_lag1", "elic_con_registros_lag1"]:
            z[col] = X[col]
        for col in ["num_anotacion", "count_a", "count_de"]:
            z[col] = np.log1p(X[col])
        rad = pd.to_datetime(X.fecha_radica_texto, format="mixed", dayfirst=True, errors="coerce")
        if rad.isna().any() or rad.dt.year.ne(X.year_radica).any():
            raise ValueError("Fecha de radicación inválida o incompatible con el año")
        z["mes_seno"] = np.sin(2 * np.pi * (rad.dt.month - 1) / 12)
        z["mes_coseno"] = np.cos(2 * np.pi * (rad.dt.month - 1) / 12)
        z["dia_mes"] = rad.dt.day
        z["predios_nuevos"] = X.predios_nuevos
        office = X.documento_justificativo.str.split(";", n=1).str[1].fillna("NO_DISPONIBLE")
        z["oficina_documento"] = office.str.upper().str.replace(r"\s+", " ", regex=True).str.strip(" -")
        return z.replace([np.inf, -np.inf], np.nan)


class CuantilMedianaExacta(RegressorMixin, BaseEstimator):
    """Regresión cuantílica q=0.5, L1; programación lineal dual exacta.

    Objetivo: 0.5 * MAE / escala + alpha * suma(abs(coeficientes)).
    La compresión conserva frecuencias de pares X,y idénticos como pesos.
    """

    def __init__(self, alpha=ALPHA, tiempo_maximo=180):
        self.alpha = alpha
        self.tiempo_maximo = tiempo_maximo

    def fit(self, X, y):
        X = np.asarray(X, dtype=float)
        y = np.asarray(y, dtype=float).ravel()
        if not np.isfinite(X).all() or not np.isfinite(y).all():
            raise ValueError("El ajuste recibió valores no finitos")
        self.n_original_ = len(y)
        pairs, inverse = np.unique(np.column_stack([X, y]), axis=0, return_inverse=True)
        weights = np.bincount(inverse).astype(float)
        X, y = pairs[:, :-1], pairs[:, -1]
        self.n_comprimidas_ = len(y)
        n, p = weights.sum(), X.shape[1]
        result = linprog(
            -y, A_ub=np.vstack([X.T, -X.T]), b_ub=np.full(2 * p, n * self.alpha),
            A_eq=np.ones((1, len(y))), b_eq=[0.],
            bounds=np.column_stack([-.5 * weights, .5 * weights]), method="highs-ds",
            options={"time_limit": float(self.tiempo_maximo), "presolve": True,
                     "dual_feasibility_tolerance": 1e-8, "primal_feasibility_tolerance": 1e-8})
        if not result.success:
            raise RuntimeError("Cuantílica sin solución certificada: " + result.message)
        self.coef_ = -result.ineqlin.marginals[:p] + result.ineqlin.marginals[p:]
        self.intercept_ = float(-result.eqlin.marginals[0])
        primal = .5 * np.sum(weights * np.abs(y - self.predict(X))) / n + self.alpha * np.abs(self.coef_).sum()
        dual = -result.fun / n
        self.brecha_primal_dual_ = float(abs(primal - dual))
        if self.brecha_primal_dual_ > 1e-6 * max(1., abs(primal)):
            raise RuntimeError("La solución no supera la comprobación primal-dual")
        self.n_iter_ = int(result.nit)
        return self

    def predict(self, X):
        check_is_fitted(self, "coef_")
        return np.asarray(X) @ self.coef_ + self.intercept_


class ModeloGAMCuantilico(RegressorMixin, BaseEstimator):
    """Modelo individual aditivo con splines y pérdida de mediana, sin árboles."""

    def __init__(self, alpha=ALPHA, tiempo_maximo=180):
        self.alpha = alpha
        self.tiempo_maximo = tiempo_maximo

    def fit(self, X, y):
        self.variables_ = PrepararVariablesGAM()
        z = self.variables_.fit_transform(X)
        nums = [c for c in z if c not in ["municipio", "oficina_documento"]]
        self.preparacion_ = ColumnTransformer([
            ("municipio", OneHotEncoder(handle_unknown="ignore", sparse_output=False), ["municipio"]),
            ("oficina", OneHotEncoder(handle_unknown="infrequent_if_exist", min_frequency=1000,
                                     max_categories=24, sparse_output=False), ["oficina_documento"]),
            ("numericas", make_pipeline(SimpleImputer(strategy="median", add_indicator=True),
                                        StandardScaler()), nums)], sparse_threshold=0).fit(z)
        self.columnas_spline_ = ["num_anotacion", "count_a", "count_de"]
        self.curvas_ = make_pipeline(
            SimpleImputer(strategy="median"),
            SplineTransformer(n_knots=4, degree=2, include_bias=False, extrapolation="linear"),
            StandardScaler()).fit(z[self.columnas_spline_])
        matrix = self._matriz(z)
        self.regresor_ = CuantilMedianaExacta(self.alpha, self.tiempo_maximo).fit(matrix, np.asarray(y) / 1e8)
        self.n_features_in_ = X.shape[1]
        return self

    def _matriz(self, z):
        return np.column_stack([self.preparacion_.transform(z), self.curvas_.transform(z[self.columnas_spline_])])

    def predict(self, X):
        check_is_fitted(self, "regresor_")
        return np.maximum(0, self.regresor_.predict(self._matriz(self.variables_.transform(X))) * 1e8)


def cargar_base(path):
    df = pd.read_csv(path, low_memory=False)
    if df.empty or not df.year_radica.between(2015, 2023).all():
        raise ValueError("Se espera el corte 2015–2023, con datos no vacíos")
    filters = (df.tipo_predio_zona.eq("URBANO") & df.nombre_natujur.eq("COMPRAVENTA")
               & df.valor.gt(0) & df.tiene_mas_de_un_valor.eq(0))
    if not filters.all():
        raise ValueError("La base debe cumplir los filtros del estudio; el script no elimina filas silenciosamente")
    if df[["municipio", "year_radica", "valor"]].isna().any().any():
        raise ValueError("Faltan claves o monto objetivo")
    df[OBJETIVO] = df.valor * df.year_radica.map(FACTORES)
    return df


def metricas(y, pred, baseline):
    errors = np.abs(np.asarray(y) - pred)
    mae = float(errors.mean())
    ref = float(mean_absolute_error(y, baseline))
    return {"mae_modelo_pesos": mae, "mae_mediana_municipal_pesos": ref,
            "reduccion_mae_pesos": ref - mae,
            "reduccion_mae_pct": 100 * (1 - mae / ref) if ref else 0.,
            "error_mediano_pesos": float(np.median(errors)),
            "p90_error_pesos": float(np.quantile(errors, .9)),
            "rmse_pesos": float(np.sqrt(mean_squared_error(y, pred))),
            "r2": float(r2_score(y, pred))}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--datos", type=Path, default=Path("datos_modelos_enriquecido_nuevo.csv"))
    p.add_argument("--salida", type=Path, default=Path("resultados_gam"))
    p.add_argument("--anios", nargs="+", type=int, choices=[2022, 2023], default=[2022, 2023])
    p.add_argument("--mlflow", action="store_true", help="Registrar parámetros, métricas y archivos de los experimentos")
    p.add_argument("--tracking-uri", default=None, help="URI del MLflow del equipo; si se omite se usa ./mlruns local")
    p.add_argument("--experimento", default="Inmobiliario_comparacion_modelos")
    a = p.parse_args()
    threadpool_limits(4)
    mlflow = None
    if a.mlflow:
        try:
            import mlflow
        except ImportError as exc:
            raise SystemExit("Instale MLflow: python -m pip install mlflow-skinny==2.22.2") from exc
        mlflow.set_tracking_uri(a.tracking_uri or Path("mlruns").resolve().as_uri())
        mlflow.set_experiment(a.experimento)
    if a.salida.exists() and any(a.salida.iterdir()):
        raise SystemExit("Use una carpeta de salida vacía para conservar los resultados anteriores")
    a.salida.mkdir(parents=True, exist_ok=True)
    data = cargar_base(a.datos)
    with a.datos.open("rb") as f:
        digest = hashlib.file_digest(f, "sha256").hexdigest()
    guardar_json(a.salida / "protocolo.json", {
        "modelo": "gam_cuantilico_sin_apertura", "alpha": ALPHA, "cuantil": .5,
        "n_knots": 4, "grado_spline": 2, "escala_objetivo": 1e8,
        "filas": len(data), "sha256_datos": digest, "ipc_pct": IPC_PCT,
        "factores_dic2023": FACTORES, "sin_recortar_extremos": True,
        "criterio": "Candidato exploratorio. Parámetros congelados; no seleccionar usando 2023.",
        "reserva": "2022 y 2023 ya se observaron en el proyecto. Evaluación retrospectiva.",
        "restriccion": "Revisar error por municipio; no garantiza rentabilidad ni avalúo individual.",
        "versiones": {"python": platform.python_version(), "numpy": np.__version__,
                      "pandas": pd.__version__, "sklearn": sklearn.__version__, "scipy": scipy.__version__}})
    summary, runs = [], []
    for year in sorted(set(a.anios)):
        train = data[data.year_radica.lt(year)]
        ev = data[data.year_radica.eq(year)]
        if train.empty or ev.empty:
            raise ValueError(f"No hay registros suficientes para el corte {year}")
        fold = a.salida / str(year)
        fold.mkdir()
        params = {"algoritmo": "gam_cuantilico_sin_apertura", "alpha": ALPHA,
                  "cuantil": .5, "n_knots": 4, "grado_spline": 2,
                  "entrenamiento": f"2015-{year-1}", "anio_evaluado": year,
                  "filas_entrenamiento": len(train), "filas_validacion": len(ev),
                  "incluye_fecha_apertura": False, "objetivo": OBJETIVO,
                  "dataset_sha256": digest}
        context = mlflow.start_run(run_name=f"gam_sin_apertura_{year}") if mlflow else nullcontext()
        with context as run:
            if mlflow:
                mlflow.log_params(params)
                mlflow.set_tags({"estado_modelo": "candidato_experimental",
                                 "tipo_evaluacion": "retrospectiva", "fase": "validacion" if year == 2022 else "comprobacion_2023"})
            start = time.perf_counter()
            model = ModeloGAMCuantilico().fit(train, train[OBJETIVO])
            pred = model.predict(ev)
            baseline = ev.municipio.map(train.groupby("municipio")[OBJETIVO].median()).fillna(train[OBJETIVO].median()).to_numpy()
            scores = metricas(ev[OBJETIVO], pred, baseline)
            scores["mae_validacion_pesos" if year == 2022 else "mae_prueba_pesos"] = scores["mae_modelo_pesos"]
            scores["segundos_ajuste_y_prediccion"] = time.perf_counter() - start
            scores["brecha_primal_dual"] = model.regresor_.brecha_primal_dual_
            local = []
            for city in sorted(ev.municipio.unique()):
                mask = ev.municipio.eq(city).to_numpy()
                local.append({"municipio": city, "n": int(mask.sum()), **metricas(ev.loc[mask, OBJETIVO], pred[mask], baseline[mask])})
            pd.DataFrame(local).to_csv(fold / "metricas_municipales.csv", index=False)
            detail = ev[["municipio", "year_radica", OBJETIVO]].copy()
            detail.insert(0, "fila_csv_base_0", ev.index)
            detail["prediccion_gam"] = pred
            detail["mediana_municipal"] = baseline
            detail.to_csv(fold / "predicciones.csv", index=False)
            joblib.dump(model, fold / "modelo.joblib", compress=3)
            guardar_json(fold / "metricas.json", scores)
            guardar_json(fold / "parametros.json", params)
            shutil.copy2(__file__, fold / "modelo_gam_cuantilico.py")
            if mlflow:
                mlflow.log_metrics(scores)
                for row in local:
                    slug = unicodedata.normalize("NFKD", row["municipio"]).encode("ascii", "ignore").decode().lower().replace(" ", "_")
                    mlflow.log_metric(f"mae_{slug}_pesos", row["mae_modelo_pesos"])
                mlflow.log_artifacts(str(fold), artifact_path="evaluacion")
                mlflow.log_artifact(str(a.salida / "protocolo.json"), artifact_path="evaluacion")
                runs.append({"anio": year, "run_id": run.info.run_id})
            summary.append({"anio": year, "n_train": len(train), "n_evaluacion": len(ev), **scores})
            print(f"{year}: GAM ${scores['mae_modelo_pesos']:,.0f} | mediana ${scores['mae_mediana_municipal_pesos']:,.0f}", flush=True)
    pd.DataFrame(summary).to_csv(a.salida / "resumen_metricas.csv", index=False)
    guardar_json(a.salida / "ejecuciones_mlflow.json", runs)
    print("Resultados:", a.salida.resolve())


if __name__ == "__main__":
    # Nombre de módulo estable: los joblib pueden recargarse desde otro proceso.
    spec = importlib.util.spec_from_file_location("modelo_gam_cuantilico", Path(__file__))
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    module.main()

