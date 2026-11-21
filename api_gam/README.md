# API del GAM inmobiliario — versión experimental

Paquete para incorporar como `Entrega_3/API_GAM/` al repositorio del equipo.
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

## Conexión con cualquier tablero

La URL de la API se configura en el tablero; no depende de su herramienta. Desde JavaScript:

```javascript
const apiBase = "http://localhost:8001"; // Sustituir por el servidor desplegado.
const respuesta = await fetch(`${apiBase}/predict`, {
  method: "POST",
  headers: {"Content-Type": "application/json"},
  body: JSON.stringify(operacion) // Mismos campos que ejemplo.json.
});
const resultado = await respuesta.json();
if (!respuesta.ok) throw new Error(JSON.stringify(resultado.detail));
console.log(resultado.prediccion_cop_dic2023);
```

`localhost` funciona solo en la misma computadora que ejecuta la API. Un tablero público necesita una dirección pública accesible; si usa HTTPS, la API también debe ofrecer HTTPS para consultas desde navegador. El despliegue no se realizó como parte de este paquete.

Para habilitar el origen real del tablero, configurar CORS_ORIGINS (sin barra final; varios orígenes separados por coma). Por defecto se permiten localhost:3000 y localhost:8501. Ejemplo PowerShell antes de arrancar:

```powershell
$env:CORS_ORIGINS="https://tablero-del-equipo.example"
```

En Docker pasar `-e CORS_ORIGINS=https://tablero-del-equipo.example` antes del nombre de imagen. CORS no es autenticación.

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

Artefacto `resultados_gam/2023/modelo.joblib`: entrenamiento 2015–2022, evaluación retrospectiva 2023. Contexto derivado del mismo archivo enriquecido del paquete. No se incluye el CSV completo ni el historial mlruns en la imagen del servicio.

El protocolo original registra Python 3.11.9, mientras el LEEME recomienda 3.12. Se propone 3.12 para Docker y Windows, conservando las versiones científicas del paquete. Repetir las pruebas al instalar o construir en el equipo de destino. Solo cargar artefactos joblib de procedencia conocida.
