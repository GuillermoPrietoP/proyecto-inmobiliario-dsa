import pandas as pd
import numpy as np

from sklearn.compose import ColumnTransformer
from sklearn.metrics import mean_absolute_error
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.ensemble import RandomForestRegressor


# Cargar datos
df = pd.read_csv("C:\\Users\\jsvic\\OneDrive\\Documentos\\GitHub\\Despliegue de soluciones\\Proyecto Inmobiliario\\proyecto-inmobiliario-dsa\\Entrega_2\\Exploracion\\datos_modelos_enriquecido.csv")

# Separación temporal
train = df[df["year_radica"] <= 2021].copy()
valid = df[df["year_radica"] == 2022].copy()
test = df[df["year_radica"] == 2023].copy()

# Modelo base: municipio + año
features = [
    "municipio",
    "year_radica",
    "poblacion_total",
    "proporcion_cabecera",
    "proporcion_25_44",
    "elic_unidades_vivienda_nueva_lag1",
]
target = "valor_real_2023"

X_train = train[features]
y_train = np.log1p(train[target])

X_valid = valid[features]
y_valid = np.log1p(valid[target])

# Transformar municipio
preprocessor = ColumnTransformer(
    transformers=[
        ("municipio", OneHotEncoder(handle_unknown="ignore"), ["municipio"])
    ],
    remainder="passthrough",
)

# Modelo
model = Pipeline(
    steps=[
        ("preprocessor", preprocessor),
        (
            "model",
            RandomForestRegressor(
                n_estimators=100,
                random_state=42,
                n_jobs=-1,
            ),
        ),
    ]
)

# Entrenamiento
model.fit(X_train, y_train)

# Evaluación de 2022 en pesos de diciembre de 2023
y_valid_pesos = valid[target]
pred_modelo_pesos = np.expm1(model.predict(X_valid))

medianas = train.groupby("municipio")[target].median()
pred_baseline_pesos = (
    valid["municipio"].map(medianas)
    .fillna(train[target].median())
)

mae_modelo = mean_absolute_error(y_valid_pesos, pred_modelo_pesos)
mae_baseline = mean_absolute_error(y_valid_pesos, pred_baseline_pesos)

print(f"MAE Random Forest con DANE y log: ${mae_modelo:,.0f}")
print(f"MAE mediana municipal:           ${mae_baseline:,.0f}")
print(f"MAE modelo menos mediana:        ${mae_modelo - mae_baseline:,.0f}")