# API del GAM inmobiliario — versión experimental

Paquete para incorporar como `api_gam/` al repositorio del equipo.
El modelo, sus clases y sus resultados proceden del paquete GAM de Jeci. La API es una nueva capa de servicio; no representa un nuevo entrenamiento ni una selección del modelo ganador.

## Arranque en Windows (PowerShell, Python 3.12)

Desde esta carpeta, ejecutar una línea por vez:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8001
```

Abrir http://localhost:8001/docs. En POST /predict pulsar Try it out, pegar `ejemplo.json` y Execute. Debe devolver HTTP 200 y `prediccion_cop_dic2023`. El servicio carga el modelo existente; no vuelve a entrenarlo.

## Docker

```powershell
docker build -t inmobiliario-gam-api .
docker run --rm -p 8001:8001 inmobiliario-gam-api
```

Puerto del contenedor: 8001. Los comandos Docker están preparados; consultar VALIDACION.md para distinguir las pruebas ejecutadas de las pendientes.

## Qué recibe

- `municipio`: uno de los seis municipios de GET /metadata (acepta minúsculas y omisión de tildes).
- `fecha_radica_texto`: fecha ISO YYYY-MM-DD, exclusivamente 2023.
- `num_anotacion`, `count_a`, `count_de`: enteros no negativos del registro original. No inventar estos atributos ni presentarlos como superficie o número de habitaciones.
- `predios_nuevos`: indicador 0/1 del conjunto del equipo.
- `documento_justificativo`: texto registral original. El modelo extrae la oficina después del punto y coma; conserva el mismo procesamiento del entrenamiento.

La API añade el contexto demográfico y económico municipal de 2023 del CSV enriquecido del equipo. Se verificó que ese contexto es uniforme por municipio. Los valores nulos originales se conservan y el modelo usa su imputación entrenada. No se requiere monto observado ni fecha de apertura.

El contrato es experimental: antes de diseñar el formulario definitivo, confirmar con el equipo la definición de cada atributo y su disponibilidad para los usuarios. Una alternativa es consultar operaciones históricas, usando sus atributos conocidos.

## Qué devuelve

`prediccion_cop_dic2023` es un valor registrado estimado, en pesos constantes de diciembre de 2023, junto con municipio, modelo, versión y advertencia. No es una estimación de rentabilidad, un avalúo ni una predicción de precios futuros. No se aceptan otros años porque el contexto fue congelado para este corte.

GET /health informa si el modelo está cargado. GET /metadata informa alcance y municipios. Entradas inválidas devuelven 422. Un fallo de inferencia devuelve 500 sin exponer datos internos.

## Pruebas

```powershell
.\.venv\Scripts\python.exe -m pip install pytest httpx
.\.venv\Scripts\python.exe -m pytest -q
```

Se comprueban 30 predicciones originales (cinco por municipio), campos inválidos, campos faltantes, metadatos y CORS. El original `modelo_gam_cuantilico.py` se conserva íntegro para que joblib encuentre sus clases.

## Incorporar al repositorio y registrar tu aporte

Copiar esta carpeta en tu clon local como `Entrega_3/API_GAM/`. Desde la raíz del repositorio:

```powershell
git switch -c aporte-api-gam
git add Entrega_3/API_GAM
git diff --cached --stat
git commit -m "Agrega API experimental del GAM y contenedor Docker"
git push -u origin aporte-api-gam
```

Revisar y ejecutar el código, entender las entradas/salidas y coordinar con el equipo antes de integrar. El commit lo realiza tu configuración de Git, sin suplantar autoría de otros. Este paquete no ha sido publicado ni enviado al repositorio. Mantener la atribución del GAM de Jeci; describir tu aporte como implementación e integración de la API, validación y empaquetamiento, con asistencia si el curso exige declararla.

## Modelo y versiones

`resultados_gam/2023/modelo.joblib`: entrenamiento 2015–2022, evaluación retrospectiva 2023. Contexto derivado del mismo archivo enriquecido del paquete.

El protocolo original registra Python 3.11.9, mientras el LEEME recomienda 3.12. Se propone 3.12 para Docker y Windows, conservando las versiones científicas del paquete. Repetir las pruebas al instalar o construir en el equipo de destino. Solo cargar artefactos joblib de procedencia conocida.

## Despliegue de prueba en AWS — 21/11/2026

API ejecutada con Docker en una instancia EC2 Ubuntu.

Documentación interactiva: http://18.205.25.216:8001/docs

### Cómo probarla

1. Abrir la documentación.
2. Expandir POST /predict y pulsar Try it out.
3. Copiar el contenido de ejemplo.json en el cuerpo de la solicitud.
4. Pulsar Execute.

Pruebas realizadas en AWS:
- GET /health: HTTP 200 y modelo_cargado: true.
- POST /predict con ejemplo.json: HTTP 200.
- Predicción obtenida: 100493070.46294704 COP constantes de diciembre de 2023.

El acceso depende de que la instancia y el laboratorio estén activos.
La IP pública puede cambiar al detener e iniciar la instancia.
