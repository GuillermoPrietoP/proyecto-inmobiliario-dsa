from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error

FEATURES = ['municipio', 'year_radica']
TARGET = 'valor_real_2023'

def load_data(path):
    df = pd.read_csv(path)
    required = FEATURES + [TARGET, 'valor', 'tipo_predio_zona', 'nombre_natujur', 'tiene_mas_de_un_valor']
    missing = set(required) - set(df)
    if missing:
        raise ValueError(f'Faltan columnas: {sorted(missing)}')
    return df

def summary(df):
    return df.groupby('municipio').agg(operaciones=(TARGET, 'size'), mediana=(TARGET, 'median'), q1=(TARGET, lambda s:s.quantile(.25)), q3=(TARGET, lambda s:s.quantile(.75))).reset_index()

def fit_model(df):
    train = df[df.year_radica <= 2021]
    valid = df[df.year_radica == 2022].copy()
    pipeline = Pipeline([
        ('preprocessor', ColumnTransformer([('municipio', OneHotEncoder(handle_unknown='ignore'), ['municipio'])], remainder='passthrough')),
        ('model', RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1))])
    pipeline.fit(train[FEATURES], np.log1p(train[TARGET]))
    medians = train.groupby('municipio')[TARGET].median()
    valid['pred_modelo'] = np.expm1(pipeline.predict(valid[FEATURES]))
    valid['pred_mediana'] = valid.municipio.map(medians)
    metrics = []
    for name, group in [('GLOBAL', valid), *list(valid.groupby('municipio'))]:
        metrics.append({'municipio': name, 'n':len(group), 'MAE modelo':mean_absolute_error(group[TARGET], group.pred_modelo), 'MAE mediana':mean_absolute_error(group[TARGET], group.pred_mediana)})
    return pipeline, medians, pd.DataFrame(metrics)
