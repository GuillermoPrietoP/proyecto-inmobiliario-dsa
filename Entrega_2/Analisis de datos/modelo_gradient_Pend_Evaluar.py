"""Modelo alternativo al Random Forest para valores inmobiliarios registrados.

Uso:
 python modelo_gradient_boosting_mae.py --datos datos_modelos_completo.csv
 python modelo_gradient_boosting_mae.py --datos datos_modelos_completo.csv --evaluar-test

Selecciona hiperparametros con 2022; 2021 es un diagnostico temporal adicional.
2023 no interviene en seleccion. --evaluar-test reentrena hasta 2022 y evalua
una vez la configuracion congelada. No modifica ni filtra el CSV de entrada.
"""
from __future__ import annotations

import os
os.environ.setdefault("OMP_NUM_THREADS", "4")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "4")

import argparse
import hashlib
import json
import platform
from pathlib import Path
import time

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingRegressor, RandomForestRegressor
from sklearn.inspection import permutation_importance
from sklearn.metrics import (mean_absolute_error, mean_squared_error,
                             median_absolute_error, r2_score)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, OrdinalEncoder
from threadpoolctl import threadpool_limits

FEATURES = ["municipio", "year_radica", "num_anotacion", "count_a", "count_de"]
BASIC = ["municipio", "year_radica"]
TARGET = "valor_real_2023"
SCALE = 1_000_000.0
SEED = 42
GRID = [
    {"max_leaf_nodes": leaves, "min_samples_leaf": minimum, "max_iter": iterations}
    for leaves, minimum, iterations in [
        (7, 100, 200), (15, 100, 200), (31, 100, 200),
        (15, 300, 300), (31, 300, 300), (31, 50, 300),
    ]
]


def json_write(path, value):
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2,
                                   allow_nan=False), encoding="utf-8")


def hgb(params, columns=FEATURES):
    # Codificacion aprendida SOLO con entrenamiento. Desconocidos -> faltante.
    preprocessing = ColumnTransformer(
        [("municipio", OrdinalEncoder(handle_unknown="use_encoded_value",
                                      unknown_value=np.nan), ["municipio"])],
        remainder="passthrough", verbose_feature_names_out=False,
    )
    estimator = HistGradientBoostingRegressor(
        loss="absolute_error", learning_rate=0.05, l2_regularization=1.0,
        categorical_features=[True] + [False] * (len(columns) - 1),
        early_stopping=False, random_state=SEED, **params,
    )
    # Sin early stopping aleatorio: las particiones de seleccion son anuales.
    return Pipeline([("preprocessor", preprocessing), ("model", estimator)])


def baseline(train, evaluation):
    medians = train.groupby("municipio")[TARGET].median()
    return evaluation.municipio.map(medians).fillna(train[TARGET].median()).to_numpy()


def metrics(y, p):
    return {
        "n": int(len(y)), "mae_cop": float(mean_absolute_error(y, p)),
        "rmse_cop": float(np.sqrt(mean_squared_error(y, p))),
        "mediana_error_absoluto_cop": float(median_absolute_error(y, p)),
        "r2": float(r2_score(y, p)),
    }


def metric_row(year, name, y, p, reference):
    result = {"year_evaluacion": year, "metodo": name, **metrics(y, p)}
    result["diferencia_mae_vs_mediana_pct"] = 100 * (result["mae_cop"] / reference - 1)
    return result


def audit(data, source):
    needed = set(FEATURES + [TARGET, "valor", "ipc_diciembre"])
    missing = needed - set(data.columns)
    if missing:
        raise ValueError(f"Faltan columnas: {sorted(missing)}")
    if data[list(needed)].isna().any().any():
        raise ValueError("Hay nulos en columnas requeridas; revisar antes de entrenar.")
    for col in needed - {"municipio"}:
        if not np.isfinite(data[col].to_numpy(dtype=float)).all():
            raise ValueError(f"Valores no finitos en {col}.")
    if (data[TARGET] <= 0).any() or (data.valor <= 0).any():
        raise ValueError("El protocolo espera montos positivos, sin excluir filas en silencio.")
    if not data.year_radica.between(2015, 2023).all():
        raise ValueError("El protocolo se definio para 2015 a 2023.")
    expected_constants = {"tipo_predio_zona": "URBANO", "nombre_natujur": "COMPRAVENTA",
                          "tiene_mas_de_un_valor": 0}
    for col, value in expected_constants.items():
        if col not in data or not data[col].eq(value).all():
            raise ValueError(f"No se cumple el filtro esperado {col}={value}.")
    if not data.groupby("year_radica").ipc_diciembre.nunique().eq(1).all():
        raise ValueError("El IPC no es unico por año.")
    ipc_2023 = data.loc[data.year_radica.eq(2023), "ipc_diciembre"].unique()
    if len(ipc_2023) != 1:
        raise ValueError("Se necesita un IPC de referencia unico para 2023.")
    reconstructed = data.valor * ipc_2023[0] / data.ipc_diciembre
    if not np.allclose(data[TARGET], reconstructed, rtol=1e-10, atol=1e-3):
        raise ValueError("valor_real_2023 no coincide con valor * IPC2023 / IPCaño.")
    for year in [2020, 2021, 2022, 2023]:
        if not data.year_radica.eq(year).any():
            raise ValueError(f"No hay registros de {year}.")
    return {
        "archivo": Path(source).name,
        "sha256": hashlib.sha256(Path(source).read_bytes()).hexdigest(),
        "filas": len(data), "columnas": list(data.columns),
        "municipios": sorted(data.municipio.unique().tolist()),
        "filas_identicas_sin_identificador": int(data.duplicated().sum()),
        "tratamiento_filas_identicas": "Se conservan: el CSV no contiene pk ni matricula.",
        "formula_ipc_validada": "valor * IPC_diciembre_2023 / IPC_diciembre_año",
        "ipc_2023": float(ipc_2023[0]),
        "nota_ipc": "Se valida consistencia interna, no procedencia del IPC con DANE.",
        "features": FEATURES, "target": TARGET,
        "excluidas_por_fuga": ["valor", "ipc_diciembre"],
        "excluidas_por_constancia": list(expected_constants),
        "sin_recorte_de_montos": True,
        "python": platform.python_version(), "sklearn": sklearn.__version__,
        "pandas": pd.__version__, "numpy": np.__version__, "joblib": joblib.__version__,
    }


def compare_references(train, evaluation, year, chosen_model, output, rows, groups):
    """Mismos datos y parametros de los scripts aportados; no se afinan RF."""
    y = evaluation[TARGET].to_numpy()
    predictions = {"Mediana municipal": baseline(train, evaluation)}
    ref = mean_absolute_error(y, predictions["Mediana municipal"])
    configs = [("Random Forest base", BASIC, False),
               ("Random Forest ampliado", FEATURES, False),
               ("Random Forest logaritmico", BASIC, True)]
    for name, columns, logarithm in configs:
        model = Pipeline([
            ("preprocessor", ColumnTransformer([
                ("municipio", OneHotEncoder(handle_unknown="ignore"), ["municipio"])
            ], remainder="passthrough")),
            ("model", RandomForestRegressor(n_estimators=100, random_state=SEED, n_jobs=4)),
        ])
        target = np.log1p(train[TARGET]) if logarithm else train[TARGET]
        model.fit(train[columns], target)
        p = model.predict(evaluation[columns])
        predictions[name] = np.expm1(p) if logarithm else p
    predictions["Gradient Boosting MAE"] = chosen_model.predict(evaluation[FEATURES]) * SCALE
    for name, p in predictions.items():
        row = metric_row(year, name, y, p, ref)
        rows.append(row)
        print(f"{year} | {name}: MAE ${row['mae_cop']:,.0f}; "
              f"vs mediana {row['diferencia_mae_vs_mediana_pct']:+.2f}%", flush=True)
        for city in sorted(evaluation.municipio.unique()):
            mask = evaluation.municipio.eq(city).to_numpy()
            city_ref = mean_absolute_error(y[mask], predictions["Mediana municipal"][mask])
            groups.append({"municipio": city,
                           **metric_row(year, name, y[mask], p[mask], city_ref)})
    export = evaluation[["municipio", "year_radica", TARGET]].copy()
    export.insert(0, "fila_csv_base_0", evaluation.index)
    for name, p in predictions.items():
        export[name] = p
    export.to_csv(output / f"predicciones_{year}.csv", index=False)
    # Diagnostico de concentracion del error. No se excluye del MAE principal.
    errors = np.abs(y - predictions["Gradient Boosting MAE"])
    extreme = y >= np.quantile(y, 0.99)
    return {"year": year, "umbral_percentil_99_cop": float(np.quantile(y, .99)),
            "filas_desde_percentil_99": int(extreme.sum()),
            "fraccion_error_absoluto_en_ese_grupo": float(errors[extreme].sum() / errors.sum())}


def save_bundle(path, model, params, train_end):
    joblib.dump({"model": model, "features": FEATURES, "target": TARGET,
                 "factor_salida_cop": SCALE, "fin_entrenamiento": train_end,
                 "parametros": params, "sklearn_version": sklearn.__version__}, path,
                compress=3)


def run(args):
    threadpool_limits(4)
    output = Path(args.salida)
    # Evita mezclar una nueva seleccion con resultados de un test anterior.
    if (output / "configuracion_congelada.json").exists():
        raise FileExistsError("La salida ya contiene un experimento. Use otra --salida.")
    output.mkdir(parents=True, exist_ok=True)
    data = pd.read_csv(args.datos)
    json_write(output / "auditoria.json", audit(data, args.datos))
    pd.crosstab(data.municipio, data.year_radica).to_csv(output / "cobertura.csv")
    experiments = []
    selected = None
    best_mae = float("inf")
    best_params = None
    # Ambos cortes son temporales; no se mezclan años aleatoriamente.
    for year in [2021, 2022]:
        train = data.loc[data.year_radica.lt(year)]
        evaluation = data.loc[data.year_radica.eq(year)]
        y = evaluation[TARGET].to_numpy()
        ref = mean_absolute_error(y, baseline(train, evaluation))
        for candidate_id, params in enumerate(GRID, start=1):
            start = time.perf_counter()
            model = hgb(params)
            model.fit(train[FEATURES], train[TARGET] / SCALE)
            p = model.predict(evaluation[FEATURES]) * SCALE
            result = {"candidato": candidate_id, **params,
                      **metric_row(year, "Gradient Boosting MAE", y, p, ref),
                      "segundos": time.perf_counter() - start}
            experiments.append(result)
            print(f"Candidato {candidate_id}, {year}: MAE ${result['mae_cop']:,.0f}", flush=True)
            # Seleccion por 2022; diagnostico 2021 no redefine la regla.
            if year == 2022 and result["mae_cop"] < best_mae:
                selected, best_mae, best_params = model, result["mae_cop"], params.copy()
    pd.DataFrame(experiments).to_csv(output / "busqueda_temporal.csv", index=False)
    frozen = {
        "familia": "HistGradientBoostingRegressor", "loss": "absolute_error",
        "learning_rate": .05, "l2_regularization": 1.0, "early_stopping": False,
        "seed": SEED, "features": FEATURES, **best_params,
        "seleccion": "Menor MAE 2022 entre seis configuraciones; entrenamiento 2015-2021.",
        "diagnostico": "2021 con entrenamiento 2015-2020; Calarca desconocido -> categoria faltante.",
        "test_2023_utilizado_para_seleccion": False,
        "escala_entrenamiento": "millones de COP constantes de diciembre de 2023",
    }
    # El manifiesto se guarda ANTES de ajustar/evaluar el modelo para 2023.
    json_write(output / "configuracion_congelada.json", frozen)
    save_bundle(output / "modelo_hgb_validacion.joblib", selected, best_params, 2021)
    train, evaluation = data[data.year_radica.le(2021)], data[data.year_radica.eq(2022)]
    rows, groups, concentration = [], [], []
    concentration.append(compare_references(train, evaluation, 2022, selected, output, rows, groups))
    # Ablacion: misma configuracion, solo municipio y año. No participa en seleccion.
    simple = hgb(best_params, BASIC)
    simple.fit(train[BASIC], train[TARGET] / SCALE)
    ablation_pred = simple.predict(evaluation[BASIC]) * SCALE
    json_write(output / "ablacion_2022.json", {
        "hgb_solo_municipio_y_año": metrics(evaluation[TARGET], ablation_pred),
        "hgb_con_campos_registrales": metrics(evaluation[TARGET], selected.predict(evaluation[FEATURES]) * SCALE),
        "regla": "Diagnostico posterior; no se cambia el modelo por este resultado.",
    })
    # Importancia predictiva sobre validacion. No implica causalidad ni disponibilidad ex ante.
    importance = permutation_importance(
        selected, evaluation[FEATURES], evaluation[TARGET] / SCALE,
        scoring="neg_mean_absolute_error", n_repeats=5, random_state=SEED, n_jobs=1)
    pd.DataFrame({"variable": FEATURES, "aumento_mae_cop": importance.importances_mean * SCALE,
                  "desviacion_repeticiones_cop": importance.importances_std * SCALE}).to_csv(
                      output / "importancia_permutacion_2022.csv", index=False)
    if args.evaluar_test:
        # Configuracion fija. Se incorpora 2022 al entrenamiento SOLO ahora.
        final_train, test = data[data.year_radica.le(2022)], data[data.year_radica.eq(2023)]
        final = hgb(best_params)
        final.fit(final_train[FEATURES], final_train[TARGET] / SCALE)
        save_bundle(output / "modelo_hgb_test.joblib", final, best_params, 2022)
        concentration.append(compare_references(final_train, test, 2023, final, output, rows, groups))
    pd.DataFrame(rows).to_csv(output / "comparacion_metricas.csv", index=False)
    pd.DataFrame(groups).to_csv(output / "metricas_por_municipio.csv", index=False)
    json_write(output / "concentracion_error.json", concentration)
    json_write(output / "protocolo.json", {
        "evaluo_test": args.evaluar_test,
        "test": "2023, entrenamiento ampliado hasta 2022 y parametros fijos" if args.evaluar_test else "2023 reservado",
        "limitacion": "Estimacion condicional del valor registrado, no avaluo ni rentabilidad.",
        "campos_registrales": "Requieren confirmar significado y disponibilidad al momento de uso.",
        "unidad": "Operacion registral; no se dispone de identificador para agrupar por inmueble.",
        "incertidumbre": "No se afirma significancia estadistica de mejoras pequeñas.",
    })
    print(f"Resultados en {output.resolve()}", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--datos", default="datos_modelos_completo.csv")
    parser.add_argument("--salida", default="resultados_gradient_boosting")
    parser.add_argument("--evaluar-test", action="store_true",
                        help="Evalua 2023 una vez con parametros seleccionados usando 2022.")
    run(parser.parse_args())
