# Tablero inmobiliario del Eje Cafetero

## Ejecutar en Windows (PowerShell)
Abra una terminal en esta carpeta y ejecute, una línea a la vez:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m streamlit run app.py
```

Abra http://localhost:8501 si el navegador no abre automáticamente.
Detener: Ctrl+C en la terminal. El entrenamiento inicial ocurre al abrir Estimaciones.

## Contenido
- app.py: interfaz Streamlit, 8 vistas adaptadas de la maqueta.
- core.py: carga, agregación y modelo experimental.
- datos/datos_modelos_completo.csv: archivo recibido, 273.734 registros.
- requirements.txt: dependencias.

## Interpretación
Valores en pesos comparables de diciembre de 2023. Cada fila es un registro de operación, no necesariamente un inmueble único.
Entrenamiento <=2021; validación 2022. El año 2023 no se usa para entrenar ni seleccionar. El RF reproduce 100 árboles y semilla 42 del script recibido; versiones de dependencias pueden afectar ligeramente resultados.
El modelo no supera globalmente a la mediana municipal en validación. No es una tasación ni proyecta rentabilidad. No se ofrecen años futuros: los árboles no extrapolan tendencias.
La vista Alertas usa un criterio exploratorio nuevo de 1,5 RIQ por municipio/año, que debe aprobar el equipo. No son anomalías confirmadas.
La base es posterior a filtros: no se inventan cifras de exclusión ni cobertura contra un universo no suministrado.
Predicciones locales; la API, Docker y el registro en MLflow corresponden a integraciones posteriores. Este tablero no reemplaza las evidencias de MLflow del equipo.

## Subir al repositorio
Copiar esta carpeta como Entrega_2/tablero; no incluir .venv ni caches.
Coordinar con el equipo la ubicación del CSV para evitar duplicarlo: ajustar `path` en app.py si se reutiliza la base existente.
