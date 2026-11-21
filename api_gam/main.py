"""API experimental del GAM de Jeci: inferencia retrospectiva, corte 2023."""
from contextlib import asynccontextmanager
from datetime import date
from pathlib import Path
import json
import os
import unicodedata
import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, field_validator
import modelo_gam_cuantilico  # Clases necesarias para deserializar el artefacto original.

ROOT = Path(__file__).resolve().parent
CONTEXT = json.loads((ROOT / 'modelos/contexto_2023.json').read_text(encoding="utf-8"))
def normalizar(value):
    return ''.join(c for c in unicodedata.normalize('NFD', value.strip().upper()) if unicodedata.category(c) != 'Mn')
CITIES = {normalizar(c): c for c in CONTEXT}
NOTICE = 'Modelo experimental retrospectivo de 2023. COP constantes de diciembre de 2023; no es avalúo ni rentabilidad.'

class Operacion(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    municipio: str = Field(min_length=1, max_length=100)
    fecha_radica_texto: date
    num_anotacion: int = Field(ge=0, le=1_000_000, strict=True)
    count_a: int = Field(ge=0, le=1_000_000, strict=True)
    count_de: int = Field(ge=0, le=1_000_000, strict=True)
    predios_nuevos: int = Field(ge=0, le=1, strict=True)
    documento_justificativo: str = Field(min_length=1, max_length=2000)

    @field_validator('municipio')
    @classmethod
    def city(cls, value):
        if normalizar(value) not in CITIES:
            raise ValueError('Municipio no soportado; consulte /metadata')
        return CITIES[normalizar(value)]

    @field_validator('fecha_radica_texto')
    @classmethod
    def year(cls, value):
        if value.year != 2023:
            raise ValueError('Esta versión solo admite fechas de 2023')
        return value

    @field_validator('documento_justificativo')
    @classmethod
    def nonblank(cls, value):
        if not value.strip():
            raise ValueError('El documento no puede estar vacío')
        return value

@asynccontextmanager
async def lifespan(app):
    app.state.modelo = joblib.load(ROOT / 'modelos/modelo.joblib')
    yield

app = FastAPI(title='API inmobiliaria GAM experimental', version='0.1.0', lifespan=lifespan)
origins = [x.strip() for x in os.getenv('CORS_ORIGINS','http://localhost:3000,http://localhost:8501').split(',') if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=['GET','POST'], allow_headers=['Content-Type'])

@app.get('/health')
def health():
    return {'estado': 'ok', 'modelo_cargado': hasattr(app.state, 'modelo')}

@app.get('/metadata')
def metadata():
    return {'modelo': 'gam_cuantilico_sin_apertura', 'version': '0.1.0',
            'entrenamiento': '2015–2022', 'anio_contexto': 2023,
            'municipios': sorted(CONTEXT), 'unidad': 'COP constantes diciembre 2023',
            'advertencia': NOTICE,
            'contexto': 'Datos municipales del archivo enriquecido del equipo, congelados en 2023.'}

@app.post('/predict')
def predict(operation: Operacion):
    row = operation.model_dump()
    row['fecha_radica_texto'] = operation.fecha_radica_texto.isoformat()
    row['year_radica'] = 2023
    row.update(CONTEXT[operation.municipio])
    try:
        value = float(app.state.modelo.predict(pd.DataFrame([row]))[0])
    except Exception as exc:
        raise HTTPException(500, 'No se pudo ejecutar el modelo') from exc
    if not np.isfinite(value):
        raise HTTPException(500, 'El modelo devolvió un resultado no finito')
    return {'prediccion_cop_dic2023': value, 'municipio': operation.municipio,
            'modelo': 'gam_cuantilico_sin_apertura', 'version': '0.1.0', 'advertencia': NOTICE}

