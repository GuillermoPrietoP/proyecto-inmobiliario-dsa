import pandas as pd

from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder


# Cargar datos
df = pd.read_csv("Entrega_2/datos_modelos_completo.csv")

# Separación temporal
train = df[df["year_radica"] <= 2021].copy()
valid = df[df["year_radica"] == 2022].copy()
test = df[df["year_radica"] == 2023].copy()

# Variables ampliadas
features = [
    "municipio",
    "year_radica",
    "num_anotacion",
    "count_a",
    "count_de",
]

target = "valor_real_2023"

X_train = train[features]
y_train = train[target]

X_valid = valid[features]
y_valid = valid[target]

# Transformar municipio
preprocessor = ColumnTransformer(
    transformers=[
        (
            "municipio",
            OneHotEncoder(
                handle_unknown="ignore",
                sparse_output=False,
            ),
            ["municipio"],
        )
    ],
    remainder="passthrough",
)

# Modelo
model = Pipeline(
    steps=[
        ("preprocessor", preprocessor),
        (
            "model",
            HistGradientBoostingRegressor(
                max_iter=100,
                learning_rate=0.1,
                random_state=42,
            ),
        ),
    ]
)

# Entrenamiento
model.fit(X_train, y_train)

# Validación 2022
pred_valid = model.predict(X_valid)

mae_modelo = mean_absolute_error(y_valid, pred_valid)

# Baseline: mediana municipal calculada solo sobre entrenamiento
medianas = train.groupby("municipio")[target].median()
pred_baseline = valid["municipio"].map(medianas)

mae_baseline = mean_absolute_error(y_valid, pred_baseline)

print("HIST GRADIENT BOOSTING")
print("Variables:", features)
print("Entrenamiento:", len(train))
print("Validación:", len(valid))
print("Prueba reservada:", len(test))
print(f"MAE modelo 2022: ${mae_modelo:,.0f}")
print(f"MAE baseline mediana 2022: ${mae_baseline:,.0f}")
print(f"Diferencia frente al baseline: ${mae_baseline - mae_modelo:,.0f}")