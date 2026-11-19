from pathlib import Path

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.base import clone


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


referencia = "Boosting con registro"
variantes = {
    referencia: features_registro,
    "Boosting con registro y demografía": features_registro + features_demografia,
    "Boosting con registro y construcción": features_registro + features_construccion,
    "Boosting con registro y economía": features_registro + features_economia,
}

variantes["Boosting con todos los bloques DANE"] = list(dict.fromkeys(
    features_registro
    + features_demografia
    + features_construccion
    + features_economia
))


# 4. Separar entrenamiento y validación
entrenamiento = datos.loc[datos["year_radica"].le(2021)].copy()
validacion = datos.loc[datos["year_radica"].eq(2022)].copy()
prueba = datos.loc[datos["year_radica"].eq(2023)].copy()

y_train = entrenamiento[objetivo]
y_valid = validacion[objetivo]
y_test = prueba[objetivo]

print(f"\nEntrenamiento hasta 2021: {len(entrenamiento):,} registros")
print(f"Validación 2022: {len(validacion):,} registros")
print(f"Prueba 2023: {len(prueba):,} registros")


# 5. Calcular la mediana histórica y entrenar las cuatro variantes
medianas = entrenamiento.groupby("municipio")[objetivo].median()
pred_mediana = validacion["municipio"].map(medianas).fillna(y_train.median())

errores = validacion[["municipio"]].copy()
errores["Mediana municipal"] = (y_valid - pred_mediana).abs()

for nombre, variables in variantes.items():
    print(f"\nEntrenando {nombre}...", flush=True)

    preprocesador = ColumnTransformer(
        transformers=[
            (
                "municipio",
                OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                ["municipio"],
            ),
        ],
        remainder="passthrough",
    )

    modelo = Pipeline([
        ("preprocesador", preprocesador),
        ("modelo", HistGradientBoostingRegressor(
            loss="absolute_error",
            max_iter=100,
            learning_rate=0.1,
            early_stopping=False,
            random_state=42,
        )),
    ])

    modelo.fit(entrenamiento[variables], y_train)
    prediccion = modelo.predict(validacion[variables])
        # Error absoluto en millones de pesos de diciembre de 2023
    error_millones = (y_valid - prediccion).abs() / 1_000_000

    print(f"\nErrores de {nombre} · Validación 2022")
    print(f"MAE:                  {error_millones.mean():,.2f} millones")
    print(f"Error absoluto mediano: {error_millones.median():,.2f} millones")
    print(f"Percentil 90 del error:  {error_millones.quantile(0.90):,.2f} millones")

    detalle = validacion[["municipio"]].copy()
    detalle["error_millones"] = error_millones

    resumen_errores = detalle.groupby("municipio")["error_millones"].agg(
        registros="size",
        mae="mean",
        error_mediano="median",
        p90=lambda errores: errores.quantile(0.90),
    )

    print("\nErrores por municipio · Millones de pesos de 2023")
    print(resumen_errores.round(2).to_string())
    errores[nombre] = (y_valid - prediccion).abs()


# 6. Mostrar el MAE general y por municipio
mae_general = errores.drop(columns="municipio").mean() / 1_000_000
mae_municipal = errores.groupby("municipio").mean() / 1_000_000

resumen = mae_general.rename("MAE").to_frame()
resumen["Reducción frente a Boosting con registro"] = (
    mae_general.loc[referencia] - mae_general
)

print("\nMAE general · Millones de pesos de diciembre de 2023")
print(resumen.sort_values("MAE").round(2).to_string())

print("\nMAE por municipio · Millones de pesos de diciembre de 2023")
print(mae_municipal.round(2).to_string())


# 7. Seleccionar la variante usando únicamente el MAE de 2022
mejor_variante = mae_general.loc[list(variantes)].idxmin()
mejores_variables = variantes[mejor_variante]

# 8. Reentrenar hasta 2022 y evaluar en 2023
entrenamiento_final = datos.loc[datos["year_radica"].le(2022)]
prueba = datos.loc[datos["year_radica"].eq(2023)]
y_prueba = prueba[objetivo]

# Copia la configuración del Pipeline y vuelve a ajustarlo.
modelo_final = clone(modelo)
modelo_final.fit(
    entrenamiento_final[mejores_variables],
    entrenamiento_final[objetivo],
)
pred_prueba = modelo_final.predict(prueba[mejores_variables])

# Recalcular la mediana municipal con el mismo período de entrenamiento.
medianas_finales = entrenamiento_final.groupby("municipio")[objetivo].median()
pred_mediana_prueba = (
    prueba["municipio"].map(medianas_finales)
    .fillna(entrenamiento_final[objetivo].median())
)

errores_prueba = prueba[["municipio"]].copy()
errores_prueba["Mediana municipal"] = (y_prueba - pred_mediana_prueba).abs()
errores_prueba[mejor_variante] = (y_prueba - pred_prueba).abs()

mae_prueba = errores_prueba.drop(columns="municipio").mean() / 1_000_000
mae_prueba_municipal = errores_prueba.groupby("municipio").mean() / 1_000_000

print(f"\nVariante seleccionada en 2022: {mejor_variante}")
print(f"Registros evaluados en 2023: {len(prueba):,}")
print("\nMAE general 2023 · Millones de pesos de diciembre de 2023")
print(mae_prueba.round(2).to_string())
print("\nMAE por municipio en 2023")
print(mae_prueba_municipal.round(2).to_string())