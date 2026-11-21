import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from main import app
ROOT = Path(__file__).resolve().parent
CASES = json.loads((ROOT/'casos.json').read_text())
EXPECTED = json.loads((ROOT/'esperadas.json').read_text())

@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c

def test_original_predictions(client):
    for row, expected in zip(CASES, EXPECTED):
        res = client.post('/predict', json=row)
        assert res.status_code == 200, res.text
        assert res.json()['prediccion_cop_dic2023'] == pytest.approx(expected, abs=.01)

@pytest.mark.parametrize('changes', [{'municipio':'LIMA'}, {'fecha_radica_texto':'2024-01-01'},
    {'count_a':-1}, {'count_de':1.5}, {'valor':123}, {'documento_justificativo':' '}, {'predios_nuevos':2}])
def test_invalid(client, changes):
    assert client.post('/predict',json={**CASES[0],**changes}).status_code == 422

def test_missing(client):
    row = dict(CASES[0]); row.pop('count_a')
    assert client.post('/predict',json=row).status_code == 422

def test_metadata_health_and_cors(client):
    assert client.get('/health').json()['modelo_cargado']
    assert len(client.get('/metadata').json()['municipios']) == 6
    res=client.options('/predict', headers={'Origin':'http://localhost:3000','Access-Control-Request-Method':'POST'})
    assert res.headers['access-control-allow-origin']=='http://localhost:3000'
