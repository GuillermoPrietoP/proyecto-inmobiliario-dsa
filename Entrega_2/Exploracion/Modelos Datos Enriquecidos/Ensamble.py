import numpy as np
import pandas as pd

from pathlib import Path

from lightgbm import LGBMRegressor
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.metrics import mean_absolute_error, median_absolute_error


# 1. Cargar la base desde la carpeta donde está este script
ruta_csv = Path(__file__).resolve().with_name("datos_modelos_enriquecido_nuevo.csv")
datos = pd.read_csv(ruta_csv)

# Variación anual del IPC nacional a diciembre, en porcentaje.
ipc_anual_pct = pd.Series({
    2016: 5.75,
    2017: 4.09,
    2018: 3.18,
    2019: 3.80,
    2020: 1.61,
    2021: 5.62,
    2022: 13.12,
    2023: 9.28,
})

anio_base = 2023
factor_por_anio = pd.Series({
    anio: (1 + ipc_anual_pct.loc[anio + 1:anio_base] / 100).prod()
    for anio in range(2015, anio_base + 1)
})

filtro_monetario = (
    datos["valor"].gt(0)
    & datos["tiene_mas_de_un_valor"].eq(0)
)
datos = datos.loc[filtro_monetario].copy()
datos["factor_ipc"] = datos["year_radica"].map(factor_por_anio)

if datos["factor_ipc"].isna().any():
    raise ValueError("Hay años de radicación sin factor de ajuste por IPC.")

datos["valor_cop_dic2023"] = (
    datos["valor"] * datos["factor_ipc"]
)

objetivo = "valor_cop_dic2023"
claves = ["municipio", "year_radica"]

# 2. Crear las variables derivadas
grupos_edad = {
    "proporcion_0_17": [f"poblacion_edad_{edad}" for edad in range(18)],
    "proporcion_18_24": [f"poblacion_edad_{edad}" for edad in range(18, 25)],
    "proporcion_65_mas": [
        *[f"poblacion_edad_{edad}" for edad in range(65, 85)],
        "poblacion_edad_85_mas",
    ],
}

poblacion_total = datos["poblacion_total"]
poblacion_positiva = poblacion_total.where(poblacion_total.gt(0))

for nombre, edades in grupos_edad.items():
    conteo = datos[edades].sum(axis=1, min_count=len(edades))
    datos[nombre] = conteo / poblacion_positiva

# Buscar la población del año exacto de cada rezago.
poblacion_anual = datos[claves + ["poblacion_total"]].drop_duplicates()

if poblacion_anual.duplicated(claves).any():
    raise ValueError("Hay distintos totales de población para un municipio y año.")

poblacion_por_clave = poblacion_anual.set_index(claves)["poblacion_total"]

for rezago in (1, 2):
    claves_rezagadas = pd.MultiIndex.from_arrays(
        [datos["municipio"], datos["year_radica"] - rezago],
        names=claves,
    )
    poblacion_rezagada = poblacion_por_clave.reindex(claves_rezagadas)
    datos[f"poblacion_lag{rezago}"] = (
        poblacion_rezagada.where(poblacion_rezagada.gt(0)).to_numpy()
    )

datos["viviendas_por_1000"] = (
    1_000 * datos["elic_unidades_vivienda_nueva_lag1"]
    / datos["poblacion_lag1"]
)

# Ajustar el valor agregado con el IPC del mismo año del dato económico.
ipc_anual = datos[["year_radica", "factor_ipc"]].dropna().drop_duplicates()

if ipc_anual["year_radica"].duplicated().any():
    raise ValueError("Hay más de un IPC de diciembre para un mismo año.")

ipc_por_anio = ipc_anual.set_index("year_radica")["factor_ipc"]
ipc_2023 = ipc_por_anio.loc[2023]
ipc_rezagado = (datos["year_radica"] - 2).map(ipc_por_anio)

datos["va_total_lag2_ipc_2023_por_habitante"] = (
    datos["va_total_lag2"]
    * 1_000_000_000
    * ipc_2023
    / ipc_rezagado.where(ipc_rezagado.gt(0))
    / datos["poblacion_lag2"]
)

derivadas = [
    *grupos_edad,
    "viviendas_por_1000",
    "va_total_lag2_ipc_2023_por_habitante",
]

faltantes = datos[derivadas].isna().groupby(datos["year_radica"]).sum()
print("\nValores faltantes por año")
print(faltantes.to_string())

# 1. Variables
features_base = ["municipio", "year_radica"]

features_demografia = [
    "poblacion_total",
    "proporcion_cabecera",
    "proporcion_0_17",
    "proporcion_18_24",
    "proporcion_25_44",
    "proporcion_65_mas",
]

features_construccion = [
    "elic_area_vivienda_nueva_m2_lag1",
    "viviendas_por_1000",
]

features_economia = [
    "va_total_lag2_ipc_2023_por_habitante",
    "va_proporcion_secundaria_lag2",
    "va_proporcion_terciaria_lag2",
]

features_gradient = features_base + features_economia
features_lightgbm = (
    features_base
    + features_demografia
    + features_construccion
    + features_economia
)


# 2. Separación temporal
objetivo = "valor_cop_dic2023"
resultados = []
resultados_municipales = []

for anio in (2020, 2021, 2022):
    print(f"\nEvaluando {anio} con entrenamiento hasta {anio - 1}...", flush=True)

    entrenamiento = datos.loc[
        datos["year_radica"].between(2015, anio - 1)
    ].copy()

    evaluacion = datos.loc[datos["year_radica"].eq(anio)].copy()

    # Objetivo en millones de pesos de diciembre de 2023.
    y_train = entrenamiento[objetivo] / 1_000_000
    y_eval = evaluacion[objetivo] / 1_000_000

    predicciones = evaluacion[["municipio"]].copy()

    # 1. Mediana municipal
    medianas = y_train.groupby(entrenamiento["municipio"]).median()
    predicciones["Mediana municipal"] = (
        evaluacion["municipio"].map(medianas)
        .fillna(y_train.median())
    )

    # 2. Gradient Boosting con demografía
    preprocesador = ColumnTransformer(
        transformers=[
            (
                "municipio",
                OneHotEncoder(
                    handle_unknown="ignore",
                    sparse_output=False,
                ),
                ["municipio"],
            ),
        ],
        remainder="passthrough",
    )

    gradient = Pipeline([
        ("preprocesador", preprocesador),
        ("modelo", HistGradientBoostingRegressor(
            loss="absolute_error",
            max_iter=100,
            learning_rate=0.1,
            early_stopping=False,
            random_state=42,
        )),
    ])

    gradient.fit(entrenamiento[features_gradient], y_train)
    predicciones["Gradient Boosting"] = gradient.predict(
        evaluacion[features_gradient]
    )

    # 3. LightGBM con todos los bloques DANE
    X_train = entrenamiento[features_lightgbm].copy()
    X_eval = evaluacion[features_lightgbm].copy()

    tipo_municipio = pd.CategoricalDtype(
        categories=entrenamiento["municipio"].dropna().unique(),
        ordered=False,
    )

    X_train["municipio"] = X_train["municipio"].astype(tipo_municipio)
    X_eval["municipio"] = X_eval["municipio"].astype(tipo_municipio)

    lightgbm = LGBMRegressor(
        objective="regression_l1",
        n_estimators=300,
        learning_rate=0.05,
        num_leaves=15,
        max_depth=4,
        min_child_samples=100,
        reg_lambda=5,
        random_state=42,
        n_jobs=4,
        verbosity=-1,
    )

    lightgbm.fit(
        X_train,
        y_train,
        categorical_feature=["municipio"],
    )
    predicciones["LightGBM"] = lightgbm.predict(X_eval)

    # 4. Métricas generales y por municipio
    for nombre in ("Mediana municipal", "Gradient Boosting", "LightGBM"):
        error = (y_eval - predicciones[nombre]).abs()

        resultados.append({
            "anio": anio,
            "modelo": nombre,
            "registros": len(evaluacion),
            "MAE": mean_absolute_error(y_eval, predicciones[nombre]),
            "error_mediano": median_absolute_error(
                y_eval, predicciones[nombre]
            ),
            "p90": error.quantile(0.90),
        })

        detalle = evaluacion[["municipio"]].copy()
        detalle["error"] = error
        detalle["municipio_nuevo"] = ~detalle["municipio"].isin(
            entrenamiento["municipio"]
        )

        tabla = detalle.groupby("municipio").agg(
            registros=("error", "size"),
            MAE=("error", "mean"),
            error_mediano=("error", "median"),
            p90=("error", lambda valores: valores.quantile(0.90)),
            municipio_nuevo=("municipio_nuevo", "max"),
        ).reset_index()

        tabla["anio"] = anio
        tabla["modelo"] = nombre
        resultados_municipales.append(tabla)

    print(f"Completado {anio}: {len(evaluacion):,} registros", flush=True)


# 5. Comparación de los tres años
resumen = pd.DataFrame(resultados)
por_municipio = pd.concat(resultados_municipales, ignore_index=True)

mae_por_anio = resumen.pivot(
    index="anio", columns="modelo", values="MAE"
)

reduccion = pd.DataFrame({
    modelo: mae_por_anio["Mediana municipal"] - mae_por_anio[modelo]
    for modelo in ("Gradient Boosting", "LightGBM")
})

print("\nMÉTRICAS POR AÑO · Millones de pesos de diciembre de 2023")
print(resumen.round(2).to_string(index=False))

print("\nREDUCCIÓN DEL MAE FRENTE A LA MEDIANA")
print("Un valor positivo indica mejora.")
print(reduccion.round(2).to_string())

print("\nPROMEDIO DEL MAE DE LOS TRES AÑOS · Cada año tiene el mismo peso")
print(
    resumen.groupby("modelo")["MAE"]
    .mean()
    .sort_values()
    .round(2)
    .to_string()
)

print("\nMAE POR MUNICIPIO Y AÑO")
print(
    por_municipio.pivot(
        index=["anio", "municipio"],
        columns="modelo",
        values="MAE",
    ).round(2).to_string()
)

print("\nMUNICIPIOS PRESENTES EN EVALUACIÓN Y AUSENTES EN ENTRENAMIENTO")
print(
    por_municipio.loc[
        por_municipio["municipio_nuevo"], ["anio", "municipio"]
    ].drop_duplicates().to_string(index=False)
)