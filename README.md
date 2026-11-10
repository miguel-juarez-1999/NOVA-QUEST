# Subproducto 09 - Aplicación web maquetada NovaQuest

**NovaQuest** es una experiencia web educativa para explorar planetas, lunas y misiones científicas. Su interfaz adopta la forma de un archivo científico contemporáneo: navegación lateral en escritorio, barra inferior en móvil, portada editorial, fotografías espaciales y registros organizados como una mesa de control.

## Requisitos cubiertos

- Navegación lateral en escritorio y barra inferior adaptable en móvil.
- Tema libre e innovador: exploración espacial y aprendizaje científico.
- Dos páginas enlazadas: `index.html` y `misiones.html`.
- Fotografías oficiales de NASA, textos y video local.
- Diseño responsivo para móvil, tableta y escritorio.
- Carpetas separadas para estilos, scripts, imágenes y video.
- Filtros, ventana de detalles y selector interactivo de misión.

## Estructura

```text
09-aplicacion-web-maquetada-novaquest/
├── assets/
│   ├── images/
│   └── video/
├── css/
│   └── styles.css
├── js/
│   └── app.js
├── index.html
├── misiones.html
└── README.md
```

## Ejecución

Abre la carpeta en VS Code, haz clic derecho sobre `index.html` y selecciona **Open with Live Server**.

También puede ejecutarse desde una terminal:

```bash
python3 -m http.server 5500
```

Después visita `http://localhost:5500`.

## Evolución futura

El proyecto puede convertirse posteriormente en PWA incorporando manifiesto, iconos, service worker, almacenamiento local, instalación y funcionamiento sin conexión.

Las fotografías provienen de la biblioteca de imágenes de NASA. El video `viaje-orbital.mp4` corresponde a la visualización **Great Zoom into Orlando, FL: Epcot Spaceship Earth**, publicada por NASA Goddard Space Flight Center / Scientific Visualization Studio.


## Cadetes NovaQuest (videojuego)

`juego.html`: el niño se registra con el código de su grupo, lee un artículo corto de la misión y responde jugando un juego de naves: los alienígenas comandantes llevan las respuestas y hay que dispararle al correcto.

Todas las misiones usan el mismo juego (`js/juego/nave.js`), pero cada una tiene su **escenario**: cielo, lugar, enemigos, dificultad y **jefe final**. Van de la más fácil a la más difícil:

| Misión | Escenario | Enemigos | Jefe final (puntos extra) | Dificultad |
|---|---|---|---|---|
| NQ-01 La Tierra | De noche sobre la Tierra: Vía Láctea y luces de ciudades | Medusas, calamares, pulpos | Kraken orbital (+20) | ★☆☆☆☆☆ |
| NQ-02 La Luna | Cielo negro sobre la Luna, con la Tierra a lo lejos | Polillas, escarabajos, rocosos | Cangrejo de cráter (+25) | ★★☆☆☆☆ |
| NQ-03 Estación Espacial | El cielo azul original, sobre la Tierra | Abejas, mariposas, comandantes | Nave nodriza (+30) | ★★★☆☆☆ |
| NQ-04 Satélites | Auroras verdes sobre el polo | Drones, antenas, nodos | Satélite renegado (+35) | ★★★★☆☆ |
| NQ-05 El Sol | Cielo rojo y llamaradas cerca del Sol | Chispas, salamandras, fénix | Fénix solar (+40) | ★★★★★☆ |
| NQ-06 Constelaciones | Nebulosa morada con una galaxia | Cristales, astros, espectros | Devorador de estrellas (+50) | ★★★★★★ |

Los escenarios están en `ESCENARIOS` (`js/juego/nave.js`); la dificultad se ajusta con unos números por escenario (filas de enemigos, cuántos bajan a la vez, velocidad de sus disparos, premios…). Los cielos se dibujan con el canvas al cargar el juego (`crearCielos`) y los jefes con figuras (`crearJefes`).

**Jefe final**: aparece al contestar la última pregunta. Tiene barra de vida, ataques propios (abanico, disparos apuntados, lluvia, espiral), suelta escoltas y entra en **furia** a media vida. Si el niño lo derrota, el servidor da los puntos extra (`r=jefe`, tabla `jefes_derrotados`) **una sola vez por misión** y solo si la misión está completada. Si el jefe gana, se puede pelear otra vez o terminar la misión sin los puntos extra.

**Lecturas tipo artículo**: cada misión tiene un artículo corto (unos 3 minutos de lectura) con subtítulos, listas y un recuadro "¿Sabías que...?". Se escriben en `articulos.contenido` con un formato sencillo: `## Subtítulo`, `- lista`, `> ¿Sabías que...?`, `**negritas**` y una línea en blanco entre párrafos.

- **El servidor califica**: la respuesta correcta nunca llega al navegador; los puntos, las insignias y el ranking se calculan en `api/index.php`.
- **Funciona sin conexión** (PWA): cada pregunta trae una clave (`sha256(sal:id_correcta)`) para calificar en el navegador; las respuestas se guardan en IndexedDB (`js/juego/pendientes.js`) y el service worker las envía solo al volver el internet (Background Sync).
- **Avisos push del juego**: "te rebasaron en el ranking", "tu misión sigue a medias" y logros (`api/juego/`, `js/juego/avisos.js`).
- **Botón atrás**: cada pantalla tiene su ruta (`#misiones`, `#mision/NQ-03`, `#jugar/NQ-03`, `#resultado`).

### Archivos

```text
js/juego/
├── juego.js         pantallas, rutas, lecturas, modo sin conexión y escenario de cada misión
├── nave.js          juego de naves con sus 6 escenarios
├── pendientes.js    bandeja de respuestas sin conexión (página y service worker)
└── avisos.js        botón de avisos push del juego
api/juego/           avisos.php (qué avisar y a quién) · enviar.php (recordatorio diario)
api/sql/             juego-avisos.sql · juego-misiones-v2.sql (artículos y preguntas)
tests/juego.php      pruebas del juego contra la API
```

### Instalación (una vez, después de hacer pull)

```bash
mysql -h127.0.0.1 -P3307 -uroot -proot --default-character-set=utf8mb4 novaquest < api/sql/juego-avisos.sql
mysql -h127.0.0.1 -P3307 -uroot -proot --default-character-set=utf8mb4 novaquest < api/sql/juego-misiones-v2.sql
```

(Cambia `-P3307` por el puerto de tu MySQL.) Si tu MySQL no usa el puerto de `api/config.php`, crea `api/config.local.php` con tus datos: git lo ignora.

### Pruebas

```bash
C:MAMPinphpphp8.3.1php.exe -c C:MAMPconfphp8.3.1php.ini testsjuego.php
```

Registra un cadete temporal, revisa artículos, preguntas, calificación, insignias, misión desactivada y avisos, y lo borra al terminar.

## Aportación de Kevin: NQ Orbit Explorer

La rama `feature/kevin-nasa-explorer` agrega una beta independiente para explorar objetos cercanos a la Tierra con datos abiertos de NASA NeoWs, sin sustituir el videojuego ni la línea del tiempo del equipo.

- Pantalla nueva: `explorador.html`.
- Lógica aislada: `js/kevin/nasa-explorer.js`.
- Estilos aislados: `css/kevin/explorador.css`.
- Caché NASA integrado cuidadosamente en `sw.js`.
- Migraciones MySQL aditivas: `api/sql/kevin/`.
- Revisión de la base de datos: `docs/kevin/REVISION_BASE_DATOS.md`.

La visualización es educativa y no representa órbitas o distancias a escala. Los datos numéricos se obtienen de NASA cuando existe conexión y la PWA conserva una respuesta reciente mediante Cache API.
