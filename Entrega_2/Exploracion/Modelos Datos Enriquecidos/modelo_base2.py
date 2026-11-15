import pandas as pd

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

# Modelo base: municipio + año + bases DANE
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
y_train = train[target]

X_valid = valid[features]
y_valid = valid[target]

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

# Predicción sobre 2022
pred_valid = model.predict(X_valid)

# Evaluación
mae_modelo = mean_absolute_error(y_valid, pred_valid)

# Baseline: mediana por municipio calculada solo con entrenamiento
medianas = train.groupby("municipio")[target].median()
pred_baseline = valid["municipio"].map(medianas)

mae_baseline = mean_absolute_error(y_valid, pred_baseline)

print("MODELO BASE")
print("Variables:", features)
print("Entrenamiento:", len(train))
print("Validación:", len(valid))
print("Prueba reservada:", len(test))
print(f"MAE modelo 2022: ${mae_modelo:,.0f}")
print(f"MAE baseline mediana 2022: ${mae_baseline:,.0f}")
print(f"Diferencia frente al baseline: ${mae_baseline - mae_modelo:,.0f}")

from sklearn.base import clone

features_base = ["municipio", "year_radica"]

modelo_solo_base = clone(model)
modelo_solo_base.fit(train[features_base], y_train)
pred_solo_base = modelo_solo_base.predict(valid[features_base])

diagnostico = valid[["municipio"]].copy()
diagnostico["Mediana municipal"] = (y_valid - pred_baseline).abs()
diagnostico["Random Forest base"] = (y_valid - pred_solo_base).abs()
diagnostico["Random Forest con DANE"] = (y_valid - pred_valid).abs()

errores = diagnostico.drop(columns="municipio")
print("\nMAE general en millones de pesos de 2023")
print(errores.mean().div(1_000_000).round(2))

print("\nMAE por municipio en millones de pesos de 2023")
print(diagnostico.groupby("municipio").mean().div(1_000_000).round(2))

comparacion = valid[["municipio", target]].copy()
comparacion["mediana_municipal"] = pred_baseline
comparacion["bosque_base"] = pred_solo_base
comparacion["bosque_dane"] = pred_valid

pereira = comparacion.loc[comparacion["municipio"].eq("PEREIRA")]
montos = [target, "mediana_municipal", "bosque_base", "bosque_dane"]

print("Pereira 2022 · Millones de pesos de 2023")
print(pereira[montos].div(1_000_000).describe(
    percentiles=[0.50, 0.90, 0.99]
).round(2))

train_reciente = train.loc[train["year_radica"].between(2019, 2021)]
medianas_recientes = train_reciente.groupby("municipio")[target].median()

pred_mediana_reciente = (
    valid["municipio"].map(medianas_recientes)
    .fillna(pred_baseline)
)

diagnostico["Mediana municipal 2019–2021"] = (
    y_valid - pred_mediana_reciente
).abs()

print("\nMAE general 2022 · Millones de pesos de 2023")
print(diagnostico.drop(columns="municipio").mean().div(1_000_000).round(2))

print("\nMAE por municipio 2022 · Millones de pesos de 2023")
print(diagnostico.groupby("municipio").mean().div(1_000_000).round(2))