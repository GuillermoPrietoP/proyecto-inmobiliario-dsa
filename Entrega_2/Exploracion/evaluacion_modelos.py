"""Compara predicciones por compraventa sobre un mismo corte de prueba."""

import argparse
from pathlib import Path
import pandas as pd

OBJETIVO = "valor_real_2023"
REFERENCIA = "Mediana municipal"

def evaluar(datos, archivos_modelos, salida):
    # El CSV original no tiene pk. El ID corresponde al orden del CSV.
    datos = datos.rename_axis("id_fila").reset_index()
    entrenamiento = datos.loc[datos["year_radica"].between(2015, 2022)]
    prueba = datos.loc[
        datos["year_radica"].eq(2023), ["id_fila", "municipio", OBJETIVO]
    ].copy()
    if entrenamiento.empty or prueba.empty:
        raise ValueError("Se requieren datos de entrenamiento y de prueba de 2023.")

    medianas = entrenamiento.groupby("municipio")[OBJETIVO].median()
    prueba[REFERENCIA] = prueba["municipio"].map(medianas)
    if prueba[[OBJETIVO, REFERENCIA]].isna().any().any():
        raise ValueError("Hay valores reales faltantes o municipios sin mediana histórica.")

    modelos = [REFERENCIA]
    for archivo in archivos_modelos:
        nombre = archivo.stem
        if nombre in prueba.columns:
            raise ValueError(f"Nombre de modelo repetido o reservado: {nombre}")
        predicciones = pd.read_csv(archivo, usecols=["id_fila", "prediccion"])
        ids = pd.Index(predicciones["id_fila"])
        ids_prueba = pd.Index(prueba["id_fila"])
        if not ids.is_unique or len(ids) != len(ids_prueba) or not ids_prueba.isin(ids).all():
            raise ValueError(f"{archivo}: debe incluir una predicción por cada ID de 2023.")
        valores = pd.to_numeric(predicciones["prediccion"], errors="raise")
        if valores.isna().any() or valores.abs().eq(float("inf")).any():
            raise ValueError(f"{archivo}: hay predicciones faltantes o infinitas.")
        prueba[nombre] = prueba["id_fila"].map(pd.Series(valores.to_numpy(), index=ids))
        modelos.append(nombre)

    errores = prueba.melt(
        id_vars=["id_fila", "municipio", OBJETIVO],
        value_vars=modelos,
        var_name="modelo",
        value_name="prediccion",
    )
    errores["error_absoluto_millones"] = (
        errores["prediccion"].sub(errores[OBJETIVO]).abs() / 1_000_000
    )
    metricas = {
        "ventas": ("id_fila", "size"),
        "mae_millones": ("error_absoluto_millones", "mean"),
        "mediana_error_millones": ("error_absoluto_millones", "median"),
    }
    por_ciudad = errores.groupby(["modelo", "municipio"], as_index=False).agg(**metricas)
    globales = errores.groupby("modelo", as_index=False).agg(**metricas).assign(municipio="TOTAL")
    resultados = pd.concat([globales, por_ciudad], ignore_index=True)[por_ciudad.columns]
    referencia = resultados.loc[resultados["modelo"].eq(REFERENCIA)].set_index("municipio")
    resultados["mejora_mae_millones"] = (
        resultados["municipio"].map(referencia["mae_millones"]) - resultados["mae_millones"]
    )

    salida.mkdir(parents=True, exist_ok=True)
    medianas.rename("mediana_cop_dic2023").to_csv(salida / "medianas_municipales.csv")
    prueba.to_csv(salida / "predicciones_2023.csv", index=False)
    resultados.to_csv(salida / "comparacion_modelos_2023.csv", index=False)
    return resultados


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("datos", type=Path, help="Ruta a datos_modelos_completo.csv")
    parser.add_argument("--modelo", type=Path, action="append", default=[],
                        help="CSV con id_fila y prediccion en COP de diciembre de 2023")
    parser.add_argument("--salida", type=Path, default=Path("evaluacion_2023"))
    args = parser.parse_args()
    resultados = evaluar(pd.read_csv(args.datos), args.modelo, args.salida)
    print(resultados.round(2).to_string(index=False))


if __name__ == "__main__":
    main()
