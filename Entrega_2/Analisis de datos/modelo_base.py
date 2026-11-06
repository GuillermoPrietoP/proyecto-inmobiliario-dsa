import pandas as pd

from sklearn.compose import ColumnTransformer
from sklearn.metrics import mean_absolute_error
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.ensemble import RandomForestRegressor


# Cargar datos
df = pd.read_csv("Entrega_2/datos_modelos_completo.csv")

# Separación temporal
train = df[df["year_radica"] <= 2021].copy()
valid = df[df["year_radica"] == 2022].copy()
test = df[df["year_radica"] == 2023].copy()

# Modelo base: municipio + año
features = ["municipio", "year_radica"]
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