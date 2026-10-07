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

Autor: Miguel Juárez Condado - Matrícula 2311080460.
# NOVA-QUEST
