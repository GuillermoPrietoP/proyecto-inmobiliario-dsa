import numpy as np
import pandas as pd

from pathlib import Path

from lightgbm import LGBMRegressor
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.metrics import mean_absolute_error, median_absolute_error

import hashlib

import mlflow
import mlflow.catboost
import mlflow.sklearn
import numpy as np

from catboost import CatBoostRegressor
from mlflow.models import infer_signature

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


# 1. Conexión al servidor de MLflow del proyecto
mlflow.set_tracking_uri("http://localhost:8050")
mlflow.set_experiment("comparacion-catboost-gradient-dane")


# 2. Datos y separación temporal
objetivo = "valor_cop_dic2023"
features_base = ["municipio", "year_radica"]

features_demografia = [
    "poblacion_total",
    "proporcion_cabecera",
    "proporcion_0_17",
    "proporcion_18_24",
    "proporcion_25_44",
    "proporcion_65_mas",
]

entrenamiento = datos.loc[
    datos["year_radica"].between(2015, 2021)
].copy()
validacion = datos.loc[datos["year_radica"].eq(2022)].copy()

# Los modelos predicen millones de pesos de diciembre de 2023.
y_train = entrenamiento[objetivo] / 1_000_000
y_valid = validacion[objetivo] / 1_000_000

medianas = y_train.groupby(entrenamiento["municipio"]).median()
pred_mediana = (
    validacion["municipio"].map(medianas)
    .fillna(y_train.median())
)
mae_mediana = (y_valid - pred_mediana).abs().mean()

# Identificar exactamente el CSV usado en el experimento.
with open(ruta_csv, "rb") as archivo:
    hash_csv = hashlib.file_digest(archivo, "sha256").hexdigest()


# 3. Configuraciones que vamos a registrar
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

catboost = CatBoostRegressor(
    loss_function="MAE",
    iterations=600,
    depth=5,
    learning_rate=0.1,
    l2_leaf_reg=6,
    random_seed=42,
    thread_count=4,
    allow_writing_files=False,
    verbose=100,
)

configuraciones = [
    (
        "gradient_boosting_demografia",
        gradient,
        features_base + features_demografia,
        "sklearn",
    ),
    (
        "catboost_base",
        catboost,
        features_base,
        "catboost",
    ),
]


# 4. Una corrida independiente para cada modelo
for nombre, modelo, variables, tipo in configuraciones:
    X_train = entrenamiento[variables].copy()
    X_valid = validacion[variables].copy()

    if tipo == "catboost":
        for tabla in (X_train, X_valid):
            tabla["municipio"] = (
                tabla["municipio"].fillna("SIN_MUNICIPIO").astype(str)
            )

    with mlflow.start_run(run_name=f"{nombre}_validacion_2022") as corrida:
        print(f"\nEntrenando y registrando {nombre}...", flush=True)

        mlflow.log_params({
            "algoritmo": nombre,
            "entrenamiento": "2015-2021",
            "validacion": "2022",
            "objetivo": objetivo,
            "unidad_prediccion": "millones_COP_diciembre_2023",
            "filas_entrenamiento": len(entrenamiento),
            "filas_validacion": len(validacion),
        })
        mlflow.set_tag("dataset_sha256", hash_csv)
        mlflow.log_dict({"features": variables}, "features.json")

        estimador = (
            modelo.named_steps["modelo"]
            if tipo == "sklearn"
            else modelo
        )
        mlflow.log_params(estimador.get_params())

        if tipo == "catboost":
            modelo.fit(X_train, y_train, cat_features=["municipio"])
        else:
            modelo.fit(X_train, y_train)

        prediccion = modelo.predict(X_valid)
        error = (y_valid - prediccion).abs()
        mae = error.mean()

        # Métricas en pesos para mantener una escala explícita.
        mlflow.log_metrics({
            "mae_validacion_pesos": mae * 1_000_000,
            "error_mediano_pesos": error.median() * 1_000_000,
            "p90_error_pesos": error.quantile(0.90) * 1_000_000,
            "mae_mediana_municipal_pesos": mae_mediana * 1_000_000,
            "reduccion_mae_pesos": (mae_mediana - mae) * 1_000_000,
        })

        detalle = validacion[["municipio"]].copy()
        detalle["error_pesos"] = error * 1_000_000
        tabla_municipal = (
            detalle.groupby("municipio")["error_pesos"]
            .agg(registros="size", mae="mean", error_mediano="median")
            .reset_index()
        )
        mlflow.log_table(
            tabla_municipal,
            artifact_file="errores_por_municipio.json",
        )

        ejemplo = X_valid.head(5)
        firma = infer_signature(ejemplo, modelo.predict(ejemplo))

        if tipo == "catboost":
            mlflow.catboost.log_model(
                cb_model=modelo,
                name="modelo",
                signature=firma,
                input_example=ejemplo,
            )
        else:
            mlflow.sklearn.log_model(
                sk_model=modelo,
                name="modelo",
                signature=firma,
                input_example=ejemplo,
                skops_trusted_types=[
                    "sklearn.ensemble._hist_gradient_boosting.predictor.TreePredictor"
                ],
            )

        print(f"MAE: ${mae * 1_000_000:,.0f}")
        print(f"Run ID: {corrida.info.run_id}")