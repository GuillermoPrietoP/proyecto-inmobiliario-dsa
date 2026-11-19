"""Integra el CSV inmobiliario y sus tres fuentes DANE. Requiere pandas y openpyxl."""

import argparse
from collections import Counter, defaultdict
from pathlib import Path
import re
from tempfile import TemporaryDirectory
from zipfile import ZipFile
from xml.etree import ElementTree as ET

from openpyxl import load_workbook
from openpyxl.utils import get_column_letter
import pandas as pd


CODIGOS = {
    "ARMENIA": "63001",  # Armenia, Quindío, supuesto basado en el alcance regional.
    "CALARCÁ": "63130",
    "MANIZALES": "17001",
    "PEREIRA": "66001",
    "DOSQUEBRADAS": "66170",
    "SANTA ROSA DE CABAL": "66682",
}
AREAS = {"Cabecera Municipal", "Centros Poblados y Rural Disperso", "Total"}
CLAVES = ["cod_municipio", "year_radica"]


def exigir(condicion, mensaje):
    if not condicion:
        raise ValueError(mensaje)


def filas_excel(ruta, hoja):
    libro = load_workbook(ruta, read_only=True, data_only=True)
    try:
        yield from libro[hoja].values
    finally:
        libro.close()


def filas_poblacion(ruta, indices, codigos, anios):
    """Lee el XML por bloques y decodifica solo las celdas de las filas solicitadas."""
    etiqueta = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
    base = re.compile(rb'<c r="([A-F])[0-9]+"([^>]*)><v>([^<]+)</v></c>')
    columnas = b"|".join(get_column_letter(i + 1).encode() for i in indices)
    detalle = re.compile(rb'<c r="(' + columnas + rb')[0-9]+"([^>]*)><v>([^<]+)</v></c>')
    with ZipFile(ruta) as libro:
        cadenas = [
            "".join(t.text or "" for t in item.iter(etiqueta + "t"))
            for item in ET.fromstring(libro.read("xl/sharedStrings.xml"))
        ]

        def decodificar(atributos, dato):
            return cadenas[int(dato)] if b't="s"' in atributos else int(dato)

        with libro.open("xl/worksheets/sheet1.xml") as hoja:
            resto = b""
            while bloque := hoja.read(4 * 1024 * 1024):
                *filas, resto = (resto + bloque).split(b"</row>")
                for fila in filas:
                    inicio = fila.find(b"<row ")
                    exigir(inicio >= 0, "Fila XML de población inesperada.")
                    if fila.startswith(b'<row r="1"', inicio):
                        continue
                    campos = {k: decodificar(a, v) for k, a, v in
                              base.findall(fila[inicio:inicio + 1300])}
                    if campos.get(b"E") not in anios:
                        continue
                    cod = str(campos.get(b"D")).zfill(5)
                    exigir(str(campos.get(b"C")).zfill(5) not in codigos,
                           f"Código en columna inesperada: {campos}")
                    if cod in codigos:
                        celdas = {k: decodificar(a, v) for k, a, v in detalle.findall(fila)}
                        yield cod, campos, [celdas.get(get_column_letter(i + 1).encode()) for i in indices]


def poblacion(carpeta, codigos, anios):
    ruta = carpeta / "Poblacion/Consolidado Poblacion.xlsx"
    filas = filas_excel(ruta, "Hoja1")
    try:
        encabezado = next(filas)
    finally:
        filas.close()
    exigir(encabezado[:6] == ("DP", "DPNOM", "DPMP", "MPIO", "AÑO", "ÁREA GEOGRÁFICA"),
           "Cambió la estructura del consolidado de población.")
    total = encabezado.index("Total General")
    edades = [encabezado.index(f"Total {e} {'año' if e == 1 else 'años'}") for e in range(86)]
    grupos = defaultdict(dict)
    for cod, campos, valores in filas_poblacion(ruta, [total, *edades], codigos, anios):
        anio, area = campos[b"E"], campos[b"F"]
        exigir(cod.startswith(str(campos[b"A"]).zfill(2)), f"Departamento de población inválido: {cod}")
        exigir(area in AREAS and area not in grupos[cod, anio],
               f"Área inválida o duplicada en población: {cod}, {anio}, {area}")
        exigir(all(type(v) is int and v >= 0 for v in valores),
               f"Conteo inválido en población: {cod}, {anio}, {area}")
        exigir(valores[0] == sum(valores[1:]), f"Edades no cuadran con el total: {cod}, {anio}, {area}")
        grupos[cod, anio][area] = (valores[0], valores[1:])
    registros = []
    for (cod, anio), grupo in sorted(grupos.items()):
        exigir(set(grupo) == AREAS, f"Áreas incompletas: {cod}, {anio}")
        total, por_edad = grupo["Total"]
        adultos = sum(por_edad[25:45])
        urbana = grupo["Cabecera Municipal"][0]
        rural = grupo["Centros Poblados y Rural Disperso"][0]
        exigir(total > 0 and total == urbana + rural and adultos <= total,
               f"Totales inconsistentes: {cod}, {anio}")
        registros.append((cod, anio, total, urbana / total, adultos / total, *por_edad))
    tabla = pd.DataFrame(registros, columns=[*CLAVES, "poblacion_total",
                                           "proporcion_cabecera", "proporcion_25_44",
                                           *(f"poblacion_edad_{e}" for e in range(85)),
                                           "poblacion_edad_85_mas"])
    tabla["crecimiento_poblacion"] = tabla.groupby("cod_municipio").poblacion_total.pct_change()
    # El empalme entre publicaciones puede reflejar diferencias metodológicas.
    tabla["crecimiento_poblacion_cambio_serie"] = tabla.year_radica.eq(2018).astype("int8")
    return tabla


def valor_agregado(carpeta, codigos, anios):
    ruta = carpeta / "Valor agregado/Consolidado Valor agregado.xlsx"
    tabla = pd.read_excel(ruta, dtype={"Código Municipio": str, "Código Departamento": str})
    tabla = tabla.rename(columns=lambda c: c.strip())
    tabla["Código Municipio"] = tabla["Código Municipio"].str.zfill(5)
    tabla = tabla[tabla["Código Municipio"].isin(codigos) & tabla["Año"].isin(anios)].copy()
    sectores = ["Actividades primarias *", "Actividades secundarias **", "Actividades terciarias ***"]
    total = tabla["Valor agregado"]
    exigir((total.gt(0) & tabla[sectores].ge(0).all(axis=1)
            & (tabla[sectores].sum(axis=1) - total).abs().le(0.001)).all(),
           "Valor agregado y componentes sectoriales inconsistentes.")
    # Rezago conservador para evaluación anual. La edición histórica es revisada.
    tabla["va_total"] = total
    tabla["va_proporcion_secundaria"] = tabla[sectores[1]] / total
    tabla["va_proporcion_terciaria"] = tabla[sectores[2]] / total
    variables = ["va_total", "va_proporcion_secundaria", "va_proporcion_terciaria"]
    actual = tabla.rename(columns={"Código Municipio": "cod_municipio", "Año": "year_radica"})[
        CLAVES + variables
    ]
    rezago = actual.rename(columns={v: f"{v}_lag2" for v in variables}).copy()
    rezago["year_radica"] += 2
    return actual.merge(rezago, on=CLAVES, how="left", validate="one_to_one")


def construccion(carpeta, codigos, anios):
    ruta = carpeta / "Construccion/anex-ELIC-SerieTipoBaseMun-ago2026.xlsx"
    inicio = {"77": 2005, "88": 2009, "302": 2015, "1000+": 2019}
    lista = filas_excel(ruta, "lista municipios")
    next(lista)
    cobertura = {}
    for dep, mun, _, _, grupo in lista:
        cod = str(dep).zfill(2) + str(mun).zfill(3)
        if cod in codigos:
            exigir(cod not in cobertura, f"Cobertura ELIC duplicada: {cod}")
            cobertura[cod] = inicio[str(grupo)]
    exigir(set(cobertura) == codigos, "Municipios ausentes del catálogo ELIC.")
    filas = filas_excel(ruta, "elic")
    exigir(next(filas) == ("año", "mes", "cod_depto", "cod_muni", "obj_tra",
                          "clase_suelo", "modalidad", "destino", "tipo_vivi", "VIS_NVIS",
                          "estrato", "area", "unidades", "licencias", "cobertura"),
           "Cambió el esquema ELIC.")
    sumas = defaultdict(Counter)
    vistas = set()
    for fila in filas:
        anio, mes, dep, mun, objeto, _, modalidad, destino = fila[:8]
        cod = str(dep).zfill(2) + str(mun).zfill(3)
        if cod not in codigos or anio not in anios:
            continue
        dim = (cod, anio, int(mes), *fila[4:11])
        exigir(1 <= int(mes) <= 12 and dim not in vistas, f"Clave ELIC inválida o duplicada: {dim}")
        vistas.add(dim)
        area, unidades, licencias = fila[11:14]
        exigir(all(isinstance(v, (int, float)) and v >= 0 for v in (area, unidades, licencias)),
               f"Medidas ELIC inválidas: {dim}")
        agregado = sumas[cod, anio]
        if objeto == 1 and modalidad == 1:
            agregado["elic_area_nueva_m2_lag1"] += area
            agregado["elic_licencias_nuevas_lag1"] += licencias
            if destino == 1:
                agregado["elic_area_vivienda_nueva_m2_lag1"] += area
                agregado["elic_unidades_vivienda_nueva_lag1"] += unidades
    variables = ["elic_area_nueva_m2_lag1", "elic_licencias_nuevas_lag1",
                 "elic_area_vivienda_nueva_m2_lag1", "elic_unidades_vivienda_nueva_lag1"]
    registros = []
    for cod in sorted(codigos):
        for anio in sorted(anios):
            agregado = sumas.get((cod, anio))
            dentro = anio >= cobertura[cod]
            registros.append((cod, anio + 1, int(dentro), int(agregado is not None),
                              *(agregado[v] if dentro and agregado is not None else None for v in variables)))
    return pd.DataFrame(registros, columns=[*CLAVES, "elic_en_cobertura_lag1",
                                          "elic_con_registros_lag1", *variables])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("proyecto", type=Path, help="Carpeta Proyecto Inmobiliario")
    parser.add_argument("--salida", type=Path, default=Path("datos_modelos_enriquecido.csv"))
    args = parser.parse_args()
    carpeta = args.proyecto / "Bases Complementarias"
    ruta = args.proyecto / "proyecto-inmobiliario-dsa/Entrega_2/Exploracion/datos_filtrados_reproducidos.csv"
    exigir(args.salida.resolve() != ruta.resolve(), "La salida coincide con el CSV original.")
    base = pd.read_csv(ruta, float_precision="round_trip")
    base["cod_municipio"] = base.municipio.map(CODIGOS)
    exigir(base.cod_municipio.notna().all(), "Hay municipios sin código en el CSV original.")
    codigos = set(base.cod_municipio)
    anios = set(base.year_radica)
    original = base.copy()
    claves = base[CLAVES].drop_duplicates()
    fuentes = (
        ("Población", poblacion, anios | {min(anios) - 1}, True),
        ("Valor agregado", valor_agregado, anios | {a - 2 for a in anios}, True),
        ("ELIC", construccion, {a - 1 for a in anios}, True),
    )
    for nombre, leer, periodo, obligatorio in fuentes:
        print(f"Leyendo {nombre}", flush=True)
        tabla = leer(carpeta, codigos, periodo)
        control = claves.merge(tabla, on=CLAVES, how="left", validate="one_to_one", indicator=True)
        faltantes = control.loc[control._merge.eq("left_only"), CLAVES]
        print(f"{nombre}: {len(claves) - len(faltantes)}/{len(claves)} claves emparejadas", flush=True)
        if not faltantes.empty:
            print(faltantes.sort_values(CLAVES).to_string(index=False), flush=True)
        exigir(not obligatorio or faltantes.empty, f"Faltan claves obligatorias en {nombre}.")
        base = base.merge(tabla, on=CLAVES, how="left", validate="many_to_one")
    pd.testing.assert_frame_equal(base[original.columns], original)
    args.salida.parent.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(dir=args.salida.parent) as temporal:
        provisional = Path(temporal) / args.salida.name
        base.to_csv(provisional, index=False, encoding="utf-8-sig")
        provisional.replace(args.salida)
    print(base.groupby("year_radica").agg(filas=("municipio", "size"),
          filas_con_va=("va_total", "count"),
          filas_con_va_lag2=("va_total_lag2", "count"),
          filas_con_elic=("elic_area_nueva_m2_lag1", "count")).to_string())
    print(f"{len(base):,} registros guardados en {args.salida.resolve()}")


if __name__ == "__main__":
    main()
