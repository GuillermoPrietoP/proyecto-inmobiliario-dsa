from pathlib import Path

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

ruta_csv = Path(__file__).resolve().with_name("datos_modelos_enriquecido_nuevo.csv")

claves = ["municipio", "year_radica"]


variables_registro = [
    "municipio",
    "year_radica",
    "num_anotacion"
]

variables_dane = [
    "poblacion_total",
    "proporcion_cabecera",
    "proporcion_25_44",
    "elic_unidades_vivienda_nueva_lag1",
]

datos = pd.read_csv(r"C:\Users\jsvic\OneDrive\Documentos\GitHub\Despliegue de soluciones\Proyecto Inmobiliario\proyecto-inmobiliario-dsa\Entrega_2\Exploracion\datos_modelos_enriquecido_nuevo.csv", usecols=columnas)


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

columnas = [*variables_registro, *variables_dane, objetivo]

entrenamiento = datos.loc[datos["year_radica"].le(2022)]
validacion = datos.loc[datos["year_radica"].eq(2023)]
y_train = entrenamiento[objetivo]
y_valid = validacion[objetivo]

# Referencia calculada únicamente con los datos de entrenamiento.
medianas = entrenamiento.groupby("municipio")[objetivo].median()
pred_mediana = (
    validacion["municipio"].map(medianas).fillna(y_train.median())
)

errores = validacion[["municipio"]].copy()
errores["Mediana municipal"] = (y_valid - pred_mediana).abs()

variantes = {
    "Boosting con registro": variables_registro,
    "Boosting con registro y DANE": variables_registro + variables_dane,
}

for nombre, variables in variantes.items():
    preprocesador = ColumnTransformer(
        transformers=[
            (
                "municipio",
                OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                ["municipio"],
            )
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
    errores[nombre] = (y_valid - prediccion).abs()

mae_general = errores.drop(columns="municipio").mean() / 1_000_000
mae_por_municipio = errores.groupby("municipio").mean() / 1_000_000

print(f"Entrenamiento hasta 2022: {len(entrenamiento):,} registros")
print(f"Validación 2023: {len(validacion):,} registros")

print("\nMAE general · Millones de pesos de 2023")
print(mae_general.sort_values().round(2).to_string())

print("\nMAE por municipio · Millones de pesos de 2023")
print(mae_por_municipio.round(2).to_string())

aporte_dane = (
    mae_general["Boosting con registro"]
    - mae_general["Boosting con registro y DANE"]
)
print(f"\nReducción del MAE al agregar DANE: {aporte_dane:+.2f} millones")