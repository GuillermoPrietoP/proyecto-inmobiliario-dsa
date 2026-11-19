from pathlib import Path

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.base import clone

from time import perf_counter

from lightgbm import LGBMRegressor, log_evaluation

# 1. Cargar la base desde la carpeta donde está este script
ruta_csv = Path(__file__).resolve().with_name("datos_modelos_enriquecido.csv")
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
    raise ValueError("Hay más de un factor de ajuste por IPC para un mismo año.")

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

# 1. Variables y variantes
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

variantes = {
    "LightGBM base": features_base,
    "LightGBM con demografía": features_base + features_demografia,
    "LightGBM con construcción": features_base + features_construccion,
    "LightGBM con economía": features_base + features_economia,
    "LightGBM con todos los bloques DANE": (
        features_base
        + features_demografia
        + features_construccion
        + features_economia
    ),
}


# 2. Entrenamiento y validación
objetivo = "valor_cop_dic2023"

entrenamiento = datos.loc[datos["year_radica"].le(2021)].copy()
validacion = datos.loc[datos["year_radica"].eq(2022)].copy()

# Objetivo en millones de pesos de diciembre de 2023.
y_train = entrenamiento[objetivo] / 1_000_000
y_valid = validacion[objetivo] / 1_000_000

# Categorías definidas únicamente con el entrenamiento.
tipo_municipio = pd.CategoricalDtype(
    categories=entrenamiento["municipio"].dropna().unique(),
    ordered=False,
)


# 3. Mediana municipal de referencia
medianas = y_train.groupby(entrenamiento["municipio"]).median()
pred_mediana = (
    validacion["municipio"].map(medianas)
    .fillna(y_train.median())
)

errores = validacion[["municipio"]].copy()
errores["Mediana municipal"] = (y_valid - pred_mediana).abs()


# 4. Entrenar las tres variantes
for nombre, variables in variantes.items():
    inicio = perf_counter()
    print(f"\nEntrenando {nombre}...", flush=True)

    X_train = entrenamiento[variables].copy()
    X_valid = validacion[variables].copy()

    X_train["municipio"] = X_train["municipio"].astype(tipo_municipio)
    X_valid["municipio"] = X_valid["municipio"].astype(tipo_municipio)

    modelo = LGBMRegressor(
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

    modelo.fit(
        X_train,
        y_train,
        categorical_feature=["municipio"],
        eval_set=[(X_valid, y_valid)],
        eval_metric="mae",
        callbacks=[log_evaluation(period=100)],
    )

    prediccion = modelo.predict(X_valid)
    errores[nombre] = (y_valid - prediccion).abs()

    print(
        f"Completado en {perf_counter() - inicio:.1f} segundos",
        flush=True,
    )


# 5. Resultados sobre las mismas filas de 2022
mae_general = errores.drop(columns="municipio").mean()
mae_municipal = errores.groupby("municipio").mean()

resumen = mae_general.rename("MAE").to_frame()
resumen["Reducción frente a mediana municipal"] = (
    mae_general["Mediana municipal"] - mae_general
)
resumen["Reducción frente a LightGBM base"] = (
    mae_general["LightGBM base"] - mae_general
)

print(f"\nEntrenamiento hasta 2021: {len(entrenamiento):,}")
print(f"Validación 2022: {len(validacion):,}")

print("\nLIGHTGBM · MAE EN MILLONES DE PESOS DE 2023")
print(resumen.sort_values("MAE").round(2).to_string())

print("\nMAE por municipio")
print(mae_municipal.round(2).to_string())