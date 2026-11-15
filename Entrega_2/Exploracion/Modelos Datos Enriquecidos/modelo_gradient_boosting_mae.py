from pathlib import Path

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

ruta_csv = Path(__file__).resolve().with_name("datos_modelos_enriquecido.csv")

objetivo = "valor_real_2023"

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

columnas = [*variables_registro, *variables_dane, objetivo]
datos = pd.read_csv(r"C:\Users\jsvic\OneDrive\Documentos\GitHub\Despliegue de soluciones\Proyecto Inmobiliario\proyecto-inmobiliario-dsa\Entrega_2\Exploracion\datos_modelos_enriquecido.csv", usecols=columnas)

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