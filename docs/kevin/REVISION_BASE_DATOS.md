# Revisión de la base de datos para NQ Orbit Explorer

## Resultado

El archivo `novaquest-2.sql` contiene 16 tablas y una estructura correcta para los módulos ya planteados por el equipo: usuarios, grupos, misiones, artículos, preguntas, opciones, intentos, progreso, insignias, línea del tiempo, viñetas y caché de API.

La integración de Kevin no reemplaza estas tablas ni modifica su funcionamiento. Sus migraciones aditivas se encuentran en `api/sql/kevin/`.

## Tablas existentes que se reutilizan

| Tabla | Uso posible |
|---|---|
| `usuarios` | Identificar al estudiante si después se guardan favoritos o progreso. |
| `misiones` | Crear más adelante una misión educativa relacionada con asteroides. |
| `preguntas` y `opciones` | Evaluar lo aprendido después de explorar un objeto. |
| `intentos` y `progreso` | Conservar resultados del juego o actividades educativas. |
| `objetos_espaciales` | Catálogo general de Luna, Sol, satélites y estación espacial. |

## Motivo de las nuevas tablas

`objetos_espaciales` no incluye el tipo `asteroide` y está pensado como un catálogo general. Además, una misma entidad de NASA puede tener varias aproximaciones en distintas fechas. Guardar todo en una sola fila produciría duplicación o pérdida de historial.

Por ello se agregan:

1. `cache_api_nasa`: respuesta JSON temporal del backend, aislada de los otros módulos.
2. `objetos_nasa`: identidad, tamaño, magnitud, clasificación y respuesta JSON del objeto.
3. `aproximaciones_nasa`: fecha, velocidad y distancia de cada encuentro registrado.
4. `push_nasa`: suscripciones de notificaciones exclusivas del explorador.

Esta separación mantiene una relación de uno a muchos y evita tocar las tablas creadas por Miguel y Romel.

## Estado de la beta

La persistencia local ya funciona mediante `api/kevin/index.php`: la primera consulta descarga NASA NeoWs y la segunda reutiliza `cache_api_nasa`. Los objetos y sus aproximaciones se normalizan en tablas separadas. La computadora también quedó registrada en `push_nasa` y recibió un Web Push real desde el backend local.

Para la versión pública se preparó una Edge Function independiente en `supabase/functions/kevin-nasa/` y la migración PostgreSQL equivalente. GitHub Pages seguirá publicando el frontend; Supabase alojará los datos y el código seguro que no debe quedar en el navegador.

El backend implementado:

1. Consulte NASA con una llave privada.
2. Valide y normalice la respuesta.
3. Inserte o actualice `objetos_nasa`.
4. Inserte las aproximaciones nuevas.
5. Use `cache_api_nasa` para reducir llamadas repetidas sin afectar otros módulos.
6. Entrega a la PWA la respuesta educativa y registra suscripciones Web Push.

## Lenguajes y tecnologías identificados

- HTML5: estructura de las tres pantallas.
- CSS3: identidad visual y diseño responsivo.
- JavaScript: interacción, PWA, Canvas, NASA NeoWs, caché y notificaciones locales.
- JSON: `manifest.json` y respuestas de NASA.
- SQL/MySQL: modelo de datos y migraciones.
- PHP 8 + PDO: backend local compatible con MySQL/MariaDB del equipo.
- TypeScript + Supabase Edge Functions: backend público HTTPS.
- PostgreSQL/Supabase: base pública aislada para pruebas en computadora e iPhone.
