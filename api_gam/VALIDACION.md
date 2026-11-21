# Validación de la API

Ejecutado en Python 3.12, con scikit-learn 1.8.0, numpy 2.3.5, pandas 2.2.3 y scipy 1.17.0.

Resultado: 10 pruebas aprobadas mediante FastAPI TestClient.
- Una prueba compara 30 operaciones (cinco de cada municipio) con las predicciones del archivo original de Jeci, con tolerancia absoluta de 0,01 COP.
- Siete casos de rechazo: municipio desconocido, año distinto a 2023, conteo negativo, conteo no entero, campo precio no admitido, documento vacío e indicador fuera de rango.
- Una prueba de campo faltante.
- Una prueba de salud, metadatos y origen CORS permitido.

No se entrenó nuevamente el GAM. Se cargó el artefacto original.
No se ejecutó Docker: no está instalado en el entorno de verificación.
No se desplegó públicamente, no se integró con el tablero definitivo y no se publicó en GitHub.

Antes de la entrega: ejecutar en el equipo destino, construir la imagen, probar /docs y conectar el tablero. Confirmar con el equipo que el GAM será el candidato a integrar y que los atributos registrales del formulario son apropiados para el caso de uso.
