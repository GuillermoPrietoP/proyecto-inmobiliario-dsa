import pandas as pd

from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder


df = pd.read_csv("Entrega_2/datos_modelos_completo.csv")

train = df[df["year_radica"] <= 2021].copy()
valid = df[df["year_radica"] == 2022].copy()

features = ["municipio", "year_radica"]
target = "valor_real_2023"

X_train = train[features]
y_train = train[target]

X_valid = valid[features]
y_valid = valid[target]

preprocessor = ColumnTransformer(
    transformers=[
        ("municipio", OneHotEncoder(handle_unknown="ignore"), ["municipio"])
    ],
    remainder="passthrough",
)

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

model.fit(X_train, y_train)

valid["pred_modelo"] = model.predict(X_valid)

medianas = train.groupby("municipio")[target].median()
valid["pred_baseline"] = valid["municipio"].map(medianas)

resultados = []

for municipio, grupo in valid.groupby("municipio"):
    mae_modelo = mean_absolute_error(
        grupo[target],
        grupo["pred_modelo"],
    )

    mae_baseline = mean_absolute_error(
        grupo[target],
        grupo["pred_baseline"],
    )

    resultados.append(
        {
            "municipio": municipio,
            "registros_2022": len(grupo),
            "mae_modelo": mae_modelo,
            "mae_baseline": mae_baseline,
            "diferencia": mae_baseline - mae_modelo,
        }
    )

resultados = pd.DataFrame(resultados)
resultados = resultados.sort_values("mae_modelo", ascending=False)

resultados.to_csv(
    "Entrega_2/error_por_municipio.csv",
    index=False,
)

print(resultados.to_string(index=False))