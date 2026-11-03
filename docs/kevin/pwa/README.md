# Matriz de documentación PWA — aportación de Kevin

Esta carpeta reunirá la explicación y las evidencias de la integración NASA. Cada característica se documentará con cuatro elementos: definición, implementación, código relacionado y evidencia verificable.

| N.º | Característica | Implementación prevista | Evidencia requerida | Estado |
|---:|---|---|---|---|
| 1 | Diseño responsivo | Interfaz adaptable del explorador terrestre | Escritorio, DevTools e iPhone | En desarrollo |
| 2 | Instalación | Manifest e instalación en pantalla de inicio | Icono y PWA ejecutándose instalada | Pendiente |
| 3 | HTTPS | Publicación mediante GitHub Pages | URL y conexión segura | Pendiente de publicación |
| 4 | Web App Manifest | Nombre, iconos, inicio, alcance y modo standalone | Código y panel Application | Beta |
| 5 | Service Worker | Un único `sw.js` compartido con bloques marcados de Kevin | Código, registro y estado activo | Beta |
| 6 | Funcionamiento sin conexión | App shell y último conjunto NASA disponible | Prueba Offline en DevTools | Beta parcial |
| 7 | Notificaciones push | `push_nasa`, endpoints propios y evento push compartido | Suscripción y recepción en iPhone | Pendiente |
| 8 | Almacenamiento en caché | `cache_api_nasa` en servidor y `NASA_CACHE` en navegador | Tabla, Cache Storage y prueba sin red | Beta parcial |
| 9 | Accesibilidad mediante URL | Ruta pública del fork | Apertura desde Mac e iPhone | Pendiente de publicación |
| 10 | Actualización automática | Versionado del caché y activación del Service Worker | Cambio de versión y nueva carga | Beta |
| 11 | Multiplataforma | Navegadores de escritorio y móvil | Pruebas en macOS e iOS | Pendiente |
| 12 | Capacidades del dispositivo | Interacción táctil, instalación y notificaciones | Evidencia en iPhone | Pendiente |

## Dos niveles de caché que deben explicarse

1. **`cache_api_nasa` (MySQL):** caché del servidor. Evita consultar repetidamente la API de NASA y conserva temporalmente el JSON normalizado.
2. **`NASA_CACHE` (Cache API del navegador):** caché del dispositivo administrado por `service-worker.js`. Permite reutilizar la última respuesta HTTP cuando falla la conexión.

No son la misma memoria y no se limpian de la misma manera. Esta separación será parte de la explicación y de las evidencias del punto 8.
