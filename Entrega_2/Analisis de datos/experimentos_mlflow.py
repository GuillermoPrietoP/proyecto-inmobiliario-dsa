import numpy as np
import pandas as pd
import mlflow
import mlflow.sklearn

from mlflow.models import infer_signature
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder


# Configuracion general
mlflow.set_tracking_uri("http://localhost:8050")
mlflow.set_experiment("proyecto-inmobiliario-entrega-2")

DATA_PATH = "Entrega_2/datos_modelos_completo.csv"
TARGET = "valor_real_2023"

df = pd.read_csv(DATA_PATH)

train = df[df["year_radica"] <= 2021].copy()
valid = df[df["year_radica"] == 2022].copy()
test = df[df["year_radica"] == 2023].copy()

# Baseline: mediana por municipio calculada solo con entrenamiento
medianas = train.groupby("municipio")[TARGET].median()
pred_baseline = valid["municipio"].map(medianas)
mae_baseline = mean_absolute_error(valid[TARGET], pred_baseline)


def ejecutar_experimento(
    run_name,
    features,
    transformacion_log=False,
):
    X_train = train[features]
    X_valid = valid[features]

    if transformacion_log:
        y_train = np.log1p(train[TARGET])
    else:
        y_train = train[TARGET]

    y_valid = valid[TARGET]

    preprocessor = ColumnTransformer(
        transformers=[
            (
                "municipio",
                OneHotEncoder(handle_unknown="ignore"),
                ["municipio"],
            )
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

    with mlflow.start_run(run_name=run_name):
        model.fit(X_train, y_train)

        pred_modelo = model.predict(X_valid)

        if transformacion_log:
            pred_modelo = np.expm1(pred_modelo)

        mae_modelo = mean_absolute_error(
            y_valid,
            pred_modelo,
        )

        diferencia = mae_baseline - mae_modelo

        mlflow.log_params(
            {
                "algoritmo": "RandomForestRegressor",
                "features": ",".join(features),
                "n_estimators": 100,
                "random_state": 42,
                "n_jobs": -1,
                "transformacion_log_objetivo": transformacion_log,
                "periodo_entrenamiento": "2015-2021",
                "periodo_validacion": "2022",
                "periodo_prueba_reservada": "2023",
            }
        )

        mlflow.log_metrics(
            {
                "mae_validacion_2022": mae_modelo,
                "mae_baseline_2022": mae_baseline,
                "diferencia_frente_baseline": diferencia,
                "registros_entrenamiento": len(train),
                "registros_validacion": len(valid),
                "registros_prueba_reservada": len(test),
            }
        )

        signature = infer_signature(
            X_valid,
            model.predict(X_valid),
        )

        mlflow.sklearn.log_model(
            sk_model=model,
            name="modelo",
            signature=signature,
            input_example=X_valid.head(5),
            skops_trusted_types=["sklearn.tree._tree.Tree"],
        )

        print("\nCORRIDA:", run_name)
        print("Variables:", features)
        print(f"MAE modelo 2022: ${mae_modelo:,.0f}")
        print(f"MAE baseline 2022: ${mae_baseline:,.0f}")
        print(f"Diferencia: ${diferencia:,.0f}")


ejecutar_experimento(
    run_name="random_forest_base",
    features=["municipio", "year_radica"],
)

ejecutar_experimento(
    run_name="random_forest_ampliado",
    features=[
        "municipio",
        "year_radica",
        "num_anotacion",
        "count_a",
        "count_de",
    ],
)

ejecutar_experimento(
    run_name="random_forest_log",
    features=["municipio", "year_radica"],
    transformacion_log=True,
)

print("\nExperimentos registrados correctamente en MLflow.")
