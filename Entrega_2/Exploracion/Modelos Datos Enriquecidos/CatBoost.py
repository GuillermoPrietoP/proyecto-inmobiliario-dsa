from pathlib import Path

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.base import clone

from time import perf_counter
from catboost import CatBoostRegressor

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

# 1. Definir las tres variantes
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
    "CatBoost base": features_base,
    "CatBoost con economía": features_base + features_economia,
    "CatBoost con demografía": features_base + features_demografia,
    "CatBoost con construcción": features_base + features_construccion,
    "CatBoost con todos los bloques DANE": (
        features_base
        + features_demografia
        + features_construccion
        + features_economia
    ),
}


# 2. Separar entrenamiento y validación
objetivo = "valor_cop_dic2023"

entrenamiento = datos.loc[datos["year_radica"].le(2021)].copy()
validacion = datos.loc[datos["year_radica"].eq(2022)].copy()

# Entrenar y evaluar en millones de pesos de diciembre de 2023.
y_train = entrenamiento[objetivo] / 1_000_000
y_valid = validacion[objetivo] / 1_000_000


# 3. Referencia de mediana municipal
medianas = y_train.groupby(entrenamiento["municipio"]).median()
pred_mediana = (
    validacion["municipio"].map(medianas)
    .fillna(y_train.median())
)

errores = validacion[["municipio"]].copy()
errores["Mediana municipal"] = (y_valid - pred_mediana).abs()


# 4. Entrenar cada variante
for nombre, variables in variantes.items():
    inicio = perf_counter()
    print(f"\nEntrenando {nombre}...", flush=True)

    X_train = entrenamiento[variables].copy()
    X_valid = validacion[variables].copy()

    # CatBoost recibe municipio directamente como categoría.
    for tabla in (X_train, X_valid):
        tabla["municipio"] = (
            tabla["municipio"].fillna("SIN_MUNICIPIO").astype(str)
        )

    modelo = CatBoostRegressor(
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

    modelo.fit(
        X_train,
        y_train,
        cat_features=["municipio"],
    )

    prediccion = modelo.predict(X_valid)
    errores[nombre] = (y_valid - prediccion).abs()

    print(
        f"Completado en {perf_counter() - inicio:.1f} segundos",
        flush=True,
    )


# 5. Comparar resultados en las mismas filas
mae_general = errores.drop(columns="municipio").mean()
mae_municipal = errores.groupby("municipio").mean()

resumen = mae_general.rename("MAE").to_frame()
resumen["Reducción frente a mediana municipal"] = (
    mae_general["Mediana municipal"] - mae_general
)
resumen["Reducción frente a CatBoost base"] = (
    mae_general["CatBoost base"] - mae_general
)

print(f"\nEntrenamiento hasta 2021: {len(entrenamiento):,}")
print(f"Validación 2022: {len(validacion):,}")

print("\nCATBOOST · MAE EN MILLONES DE PESOS DE 2023")
print(resumen.sort_values("MAE").round(2).to_string())

print("\nMAE por municipio")
print(mae_municipal.round(2).to_string())