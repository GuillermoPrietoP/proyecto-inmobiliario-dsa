import pandas as pd
import requests
import time

URL = "https://www.datos.gov.co/resource/7y2j-43cv.json"

municipios = [
    "ARMENIA",
    "MANIZALES",
    "PEREIRA",
    "DOSQUEBRADAS",
    "SANTA ROSA DE CABAL",
    "CALARCÁ",
]

columnas = (
    "municipio,year_radica,num_anotacion,count_a,count_de,"
    "valor,tipo_predio_zona,nombre_natujur,tiene_mas_de_un_valor"
)

datos = []

for municipio in municipios:
    print(f"Descargando {municipio}...")

    offset = 0

    while True:
        params = {
            "$select": columnas,
        "$where": (
            f"municipio='{municipio}' AND "
            "tipo_predio_zona='URBANO' AND "
            "nombre_natujur='COMPRAVENTA'"
        ),
            "$limit": 1000,
            "$offset": offset,
        }

        respuesta = requests.get(URL, params=params, timeout=120)
        respuesta.raise_for_status()
        bloque = respuesta.json()

        if not bloque:
            break

        datos.extend(bloque)
        offset += len(bloque)

        print(f"  {offset} registros")

        if len(bloque) < 1000:
            break

        time.sleep(0.5)

df = pd.DataFrame(datos)

for columna in [
    "year_radica",
    "num_anotacion",
    "count_a",
    "count_de",
    "valor",
    "tiene_mas_de_un_valor",
]:
    df[columna] = pd.to_numeric(df[columna], errors="coerce")

df = df[
    (df["valor"].notna())
    & (df["valor"] > 0)
    & (df["tiene_mas_de_un_valor"] == 0)
].copy()

ipc = pd.read_csv("Entrega_2/ipc_2015_2023.csv")
df = df.merge(ipc, on="year_radica", how="left")

df["valor_real_2023"] = (
    df["valor"] * (137.72 / df["ipc_diciembre"])
)

df.to_csv(
    "Entrega_2/datos_modelos_completo.csv",
    index=False,
)

print("\nRegistros finales por municipio:")
print(df["municipio"].value_counts())

print("\nTotal:", len(df))
print("IPC nulos:", df["ipc_diciembre"].isna().sum())
print("Valor real nulos:", df["valor_real_2023"].isna().sum())