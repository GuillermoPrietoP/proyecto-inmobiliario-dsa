from pathlib import Path

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.pipeline import Pipeline
from sklearn.base import clone
from sklearn.impute import SimpleImputer
from sklearn.linear_model import QuantileRegressor
from sklearn.preprocessing import OneHotEncoder, StandardScaler

import warnings
from time import perf_counter

from sklearn.exceptions import ConvergenceWarning


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


# 3. Definir las variantes
features_registro = [
    "municipio",
    "year_radica"
]

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


referencia = "Cuantilica con registro"
variantes = {
    referencia: features_registro,
    "Cuantilica con registro y demografía": features_registro + features_demografia,
    "Cuantilica con registro y construcción": features_registro + features_construccion,
    "Cuantilica con registro y economía": features_registro + features_economia,
}

variantes["Cuantilica con todos los bloques DANE"] = list(dict.fromkeys(
    features_registro
    + features_demografia
    + features_construccion
    + features_economia
))

# Entrenamiento hasta 2021 y validación en 2022
objetivo = "valor_cop_dic2023"

entrenamiento = datos.loc[datos["year_radica"].le(2021)].copy()
validacion = datos.loc[datos["year_radica"].eq(2022)].copy()

# Entrenar en millones facilita la escala numérica.
y_train = entrenamiento[objetivo] / 1_000_000
y_valid = validacion[objetivo] / 1_000_000

# Mediana municipal calculada exclusivamente en entrenamiento.
medianas = y_train.groupby(entrenamiento["municipio"]).median()
pred_mediana = (
    validacion["municipio"].map(medianas)
    .fillna(y_train.median())
)

errores = validacion[["municipio"]].copy()
errores["Mediana municipal"] = (y_valid - pred_mediana).abs()

for nombre, variables in variantes.items():
    inicio = perf_counter()
    print(f"\nPreparando regresión cuantílica: {nombre}", flush=True)

    numericas = [c for c in variables if c != "municipio"]

    preprocesador = ColumnTransformer(
        transformers=[
            (
                "municipio",
                OneHotEncoder(
                    handle_unknown="ignore",
                    drop="first",
                    sparse_output=False,
                ),
                ["municipio"],
            ),
            (
                "numericas",
                Pipeline([
                    ("imputacion", SimpleImputer(
                        strategy="median",
                        add_indicator=True,
                    )),
                    ("escala", StandardScaler()),
                ]),
                numericas,
            ),
        ],
    )

    # Ajustar la preparación con todas las filas de entrenamiento.
    X_train = preprocesador.fit_transform(entrenamiento[variables])
    X_valid = preprocesador.transform(validacion[variables])

    # Agrupar solamente filas con idénticos predictores y objetivo.
    tabla = pd.DataFrame(X_train)
    columnas_x = tabla.columns.tolist()
    tabla["objetivo"] = y_train.to_numpy()

    comprimida = (
        tabla.groupby(
            columnas_x + ["objetivo"],
            dropna=False,
            sort=False,
        )
        .size()
        .reset_index(name="peso")
    )

    print(
        f"Filas originales: {len(tabla):,} | "
        f"Filas comprimidas: {len(comprimida):,}",
        flush=True,
    )

    modelo = QuantileRegressor(
        quantile=0.5,
        alpha=0.01,
        solver="highs",
        solver_options={
            "presolve": True,
            "time_limit": 300,
        },
    )

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", ConvergenceWarning)

            modelo.fit(
                comprimida[columnas_x].to_numpy(),
                comprimida["objetivo"].to_numpy(),
                sample_weight=comprimida["peso"].to_numpy(),
            )

        prediccion = modelo.predict(X_valid)
        errores[nombre] = (y_valid - prediccion).abs()

        print(
            f"Completado en {perf_counter() - inicio:.1f} segundos",
            flush=True,
        )

    except ConvergenceWarning as error:
        print(
            f"La variante no convergió dentro del límite. "
            f"Queda pendiente de evaluación.\n{error}",
            flush=True,
        )

# Los errores ya están expresados en millones de pesos de 2023.
mae_general = errores.drop(columns="municipio").mean()
mae_municipal = errores.groupby("municipio").mean()

resumen = mae_general.rename("MAE").to_frame()
resumen["Reducción frente a mediana municipal"] = (
    mae_general["Mediana municipal"] - mae_general
)

print(f"\nRegistros de entrenamiento: {len(entrenamiento):,}")
print(f"Registros de validación: {len(validacion):,}")

print("\nREGRESIÓN CUANTÍLICA · VALIDACIÓN 2022")
print("MAE en millones de pesos de diciembre de 2023")
print(resumen.sort_values("MAE").round(2).to_string())

print("\nMAE por municipio")
print(mae_municipal.round(2).to_string())