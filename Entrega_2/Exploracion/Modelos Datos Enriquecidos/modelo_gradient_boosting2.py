import pandas as pd

from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder


# Cargar datos
df = pd.read_csv(r"C:\Users\jsvic\OneDrive\Documentos\GitHub\Despliegue de soluciones\Proyecto Inmobiliario\proyecto-inmobiliario-dsa\Entrega_2\Exploracion\datos_modelos_enriquecido_nuevo.csv")

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
    df["valor"].gt(0)
    & df["tiene_mas_de_un_valor"].eq(0)
)
df = df.loc[filtro_monetario].copy()
df["factor_ipc"] = df["year_radica"].map(factor_por_anio)

if df["factor_ipc"].isna().any():
    raise ValueError("Hay años de radicación sin factor de ajuste por IPC.")

df["valor_cop_dic2023"] = (
    df["valor"] * df["factor_ipc"]
)

# Separación temporal
train = df[df["year_radica"] <= 2021].copy()
valid = df[df["year_radica"] == 2022].copy()
test = df[df["year_radica"] == 2023].copy()

# Variables ampliadas
features = [
    "municipio",
    "year_radica",
    "poblacion_total",
    "proporcion_cabecera",
    "proporcion_25_44",
    "elic_unidades_vivienda_nueva_lag1",
]

target = "valor_cop_dic2023"

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
                loss = "absolute_error",
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