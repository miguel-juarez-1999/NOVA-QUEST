# Matriz de documentación PWA — aportación de Kevin

Esta carpeta reunirá la explicación y las evidencias de la integración NASA. Cada característica se documentará con cuatro elementos: definición, implementación, código relacionado y evidencia verificable.

| N.º | Característica | Implementación prevista | Evidencia requerida | Estado |
|---:|---|---|---|---|
| 1 | Diseño responsivo | Interfaz adaptable del explorador terrestre | Escritorio, DevTools e iPhone | Cumple en código; falta captura iPhone |
| 2 | Instalación | Manifest e instalación en pantalla de inicio | Icono y PWA ejecutándose instalada | Cumple en escritorio; falta captura iPhone |
| 3 | HTTPS | Publicación mediante GitHub Pages | URL y conexión segura | Cumple: `https://kevinjimarez.github.io/NOVA-QUEST/` |
| 4 | Web App Manifest | Nombre, iconos, inicio, alcance y modo standalone | Código y panel Application | Cumple |
| 5 | Service Worker | Un único `sw.js` compartido con bloques marcados de Kevin | Código, registro y estado activo | Cumple |
| 6 | Funcionamiento sin conexión | App shell y último conjunto NASA disponible | Prueba Offline en DevTools | Cumple en código; falta captura final |
| 7 | Notificaciones push | `push_nasa`, endpoints propios y evento push compartido | Suscripción y recepción en iPhone | Backend público listo; falta prueba iPhone |
| 8 | Almacenamiento en caché | `cache_api_nasa` en servidor y `NASA_CACHE` en navegador | Tabla, Cache Storage y prueba sin red | Cumple en Supabase y navegador |
| 9 | Accesibilidad mediante URL | Ruta pública del fork | Apertura desde Mac e iPhone | Cumple |
| 10 | Actualización automática | Versionado del caché y activación del Service Worker | Cambio de versión y nueva carga | Cumple |
| 11 | Multiplataforma | Navegadores de escritorio y móvil | Pruebas en macOS e iOS | Cumple en diseño; falta captura iPhone |
| 12 | Capacidades del dispositivo | Interacción táctil, instalación y notificaciones | Evidencia en iPhone | Implementado; falta captura iPhone |

## Dos niveles de caché que deben explicarse

1. **`cache_api_nasa` (PostgreSQL/Supabase público; MySQL sólo como referencia local):** caché del servidor. Evita consultar repetidamente la API de NASA y conserva temporalmente el JSON normalizado.
2. **`NASA_CACHE` (Cache API del navegador):** caché del dispositivo administrado por `service-worker.js`. Permite reutilizar la última respuesta HTTP cuando falla la conexión.

No son la misma memoria y no se limpian de la misma manera. Esta separación será parte de la explicación y de las evidencias del punto 8.

## Archivos que Kevin debe mostrar durante la presentación

| Archivo | Qué demuestra |
|---|---|
| `manifest.json` | Nombre, iconos, URL inicial, alcance, modo standalone y acceso “Selector interactivo”. |
| `sw.js` | Precaché, actualización, modo offline, `NASA_CACHE`, evento `push` y clic en notificaciones. |
| `js/kevin/nasa-explorer.js` | Consumo del backend, representación de objetos y registro del dispositivo. |
| `api/kevin/index.php` | Backend local PHP/MySQL, caché de servidor y endpoints Web Push. |
| `api/sql/kevin/01-nasa-tablas.sql` | Tablas de caché, objetos y aproximaciones de Kevin. |
| `api/sql/kevin/02-nasa-notificaciones.sql` | Tabla independiente `push_nasa`. |
| `supabase/functions/kevin-nasa/index.ts` | Backend público HTTPS para computadora e iPhone. |
| `supabase/migrations/20261103_kevin_nasa.sql` | Versión PostgreSQL de las cuatro tablas públicas. |

## Flujo para explicarlo

1. `explorador.html` carga el JavaScript de Kevin.
2. El JavaScript solicita `nasa_feed` al backend seguro.
3. El backend revisa primero `cache_api_nasa`.
4. Si el registro expiró, consulta NASA NeoWs y actualiza tres tablas.
5. La respuesta llega a la PWA y el Service Worker conserva una copia en `NASA_CACHE`.
6. Al activar notificaciones, el navegador crea una suscripción Web Push y el backend la guarda en `push_nasa`.
7. El servidor envía el aviso; `sw.js` lo recibe y lo muestra incluso si la página está cerrada.

## Consultas SQL útiles para la demostración en Supabase

```sql
SELECT clave, consultado_en, expira_en FROM cache_api_nasa;
SELECT nasa_id, nombre, potencialmente_peligroso FROM objetos_nasa;
SELECT fecha_aproximacion, velocidad_kmh, distancia_km FROM aproximaciones_nasa;
SELECT id, creado_en, ultimo_envio FROM push_nasa;
```

## Prueba pública comprobada el 3 de noviembre de 2026

- URL de la función: `https://mypfsscjvhlubdmbwazd.supabase.co/functions/v1/kevin-nasa`.
- Primera consulta: fuente `nasa_api`, 5 objetos guardados.
- Segunda consulta: fuente `cache_api_nasa`, sin repetir la llamada a NASA.
- Las tablas tienen RLS activo y no poseen políticas para visitantes.
- Solamente la Edge Function cuenta con permisos del rol `service_role`.
- Las claves NASA y VAPID permanecen cifradas en Supabase y fuera del repositorio.
