// =====================================================================
// Service Worker de NovaQuest
// =====================================================================
// Un service worker es un archivo JavaScript que el navegador ejecuta en
// segundo plano, separado de la página. Funciona como un "portero" entre
// la app y la red: intercepta cada petición y decide si la responde desde
// el caché (memoria del navegador) o desde internet.
//
// Lo que hace este archivo:
//   1. Guarda los archivos esenciales de la app al instalarse (app shell).
//   2. Limpia los cachés de versiones anteriores al activarse.
//   3. Aplica una estrategia de caché distinta según el tipo de recurso.
//
// Resultado: NovaQuest carga rápido y puede abrirse sin conexión.
// =====================================================================


// ---------------------------------------------------------------------
// 1. CONFIGURACIÓN DE LOS CACHÉS
// ---------------------------------------------------------------------

// Cambia este número cada vez que modifiques archivos del proyecto
// para que el navegador descargue y guarde la versión nueva.
// (Ejemplo: "novaquest-v2", "novaquest-v3"...)
const CACHE_VERSION = "novaquest-v9";

// Caché para los archivos propios de la app (HTML, CSS, JS, imágenes).
// Resultado: "novaquest-v1-static"
const STATIC_CACHE = `${CACHE_VERSION}-static`;

// Caché separado para las fuentes de Google, porque vienen de otro
// dominio y se manejan con otra estrategia.
// Resultado: "novaquest-v1-fonts"
const FONTS_CACHE = `${CACHE_VERSION}-fonts`;
// Caché para las respuestas de la API (datos del backend)
const API_CACHE = `${CACHE_VERSION}-api`;


// ---------------------------------------------------------------------
// 2. LISTA DE PRECARGA (APP SHELL)
// ---------------------------------------------------------------------

// Archivos que se guardan al instalar la PWA (el "app shell").
// Con esto la app puede abrir sin internet desde la primera visita.
// OJO: si UN SOLO archivo de esta lista no existe (error 404), la
// instalación completa falla. Verifica que todas las rutas sean correctas.
const PRECACHE_URLS = [
  // Páginas
  "./",
  "./index.html",
  "./misiones.html",
  "./juego.html",
  "./linea-tiempo.html",

  // Estilos y lógica
  "./css/styles.css",
  "./css/juego.css",
  "./css/tiempo.css",
  "./js/app.js",
  "./js/api.js",
  "./js/juego.js",
  "./js/nave.js",
  "./js/tiempo.js",
  "./js/vendor/phaser.min.js",

  // Gráficos del videojuego
  "./assets/juego/fondo.jpg",
  "./assets/juego/estrellas1.png",
  "./assets/juego/estrellas2.png",
  "./assets/juego/asteroide_fondo_blur.png",
  "./assets/juego/bala.png",
  "./assets/juego/brillo.png",
  "./assets/juego/fuego.png",
  "./assets/juego/luz.png",
  "./assets/juego/nave.png",
  "./assets/juego/capsula.png",
  "./assets/juego/tierra.png",

  // Configuración de la PWA
  "./manifest.json",

  // Íconos (normal, maskable para Android y el de Apple)
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-512.png",
  "./assets/icons/apple-touch-icon.png",

  // Imágenes de las misiones
  "./assets/images/nasa-deep-field.jpg",
  "./assets/images/nasa-webb.jpg",
  "./assets/images/nasa-mars-insight.jpg",
  "./assets/images/nasa-europa-clipper.jpg",
  "./assets/images/nasa-saturn-rings.jpg"
];


// ---------------------------------------------------------------------
// 3. EVENTO INSTALL
// ---------------------------------------------------------------------

// INSTALL: se ejecuta una sola vez, cuando el navegador instala esta
// versión del service worker. Aquí se guardan en caché los archivos
// esenciales.
// "self" se refiere al propio service worker.
self.addEventListener("install", (event) => {
  // waitUntil le dice al navegador: "no termines la instalación hasta
  // que esta promesa se resuelva".
  event.waitUntil(
    caches
      // Abre el caché estático (lo crea si no existe)
      .open(STATIC_CACHE)
      // Descarga y guarda TODOS los archivos de PRECACHE_URLS
      // (si uno falla, falla todo: es "todo o nada")
      .then((cache) => cache.addAll(PRECACHE_URLS))
      // Guarda también los datos públicos de la API (misiones y línea de
      // tiempo) para poder leerlos sin internet. Si el servidor no responde
      // no pasa nada: la instalación sigue.
      .then(() => precachearApi().catch(() => {}))
      // Activa esta versión de inmediato, sin esperar a que se cierren
      // las pestañas que usan la versión anterior
      .then(() => self.skipWaiting())
  );
});


// ---------------------------------------------------------------------
// 4. EVENTO ACTIVATE
// ---------------------------------------------------------------------

// ACTIVATE: se ejecuta cuando el service worker toma el control.
// Borra los cachés de versiones anteriores para no acumular basura.
self.addEventListener("activate", (event) => {
  // Cachés vigentes: estos NO se deben borrar
  const cachesPermitidos = [STATIC_CACHE, FONTS_CACHE, API_CACHE];

  event.waitUntil(
    caches
      // Lista los nombres de todos los cachés guardados
      .keys()
      .then((nombres) =>
        // Promise.all espera a que terminen todos los borrados
        Promise.all(
          nombres
            // Se queda solo con los cachés viejos (los no permitidos)
            .filter((nombre) => !cachesPermitidos.includes(nombre))
            // Borra cada uno de ellos
            .map((nombre) => caches.delete(nombre))
        )
      )
      // Toma el control de las pestañas ya abiertas sin necesidad
      // de recargarlas
      .then(() => self.clients.claim())
  );
});


// ---------------------------------------------------------------------
// 5. EVENTO FETCH (el corazón del archivo)
// ---------------------------------------------------------------------

// FETCH: intercepta cada petición de la página (HTML, CSS, JS,
// imágenes, fuentes, etc.) y decide cómo responderla.
self.addEventListener("fetch", (event) => {
  // La petición que hizo la página
  const request = event.request;

  // Objeto URL para poder revisar su dominio (hostname) y ruta (pathname)
  const url = new URL(request.url);

  // --- Filtro 1: solo GET ---
  // Solo se manejan peticiones GET. Cualquier otra (POST, PUT...) pasa
  // directo a la red. Un "return" sin respondWith significa: "yo no me
  // meto con esta petición".
  if (request.method !== "GET") return;

  // --- Filtro 2: video ---
  // El video es pesado (7.5 MB) y usa peticiones por rangos (el navegador
  // pide el video por pedacitos). El caché no maneja bien eso, así que se
  // deja pasar a la red.
  if (url.pathname.endsWith(".mp4") || request.headers.has("range")) return;

  // --- Caso API: datos del backend (PHP + MySQL) ---
  // RED PRIMERO: los datos deben ser frescos. Si no hay internet,
  // se entrega la última respuesta guardada.
  if (url.origin === self.location.origin && url.pathname.includes("/api/")) {
    event.respondWith(
      fetch(request)
        .then((respuesta) => {
          if (respuesta.ok) {
            const copia = respuesta.clone();
            caches.open(API_CACHE).then((cache) => cache.put(request, copia));
          }
          return respuesta;
        })
        .catch(() => caches.match(request).then((enCache) => enCache || Response.error()))
    );
    return;
  }

  // --- Caso A: Fuentes de Google ---
  // Estrategia stale-while-revalidate: responde al instante con lo que
  // hay en caché y, en paralelo, actualiza el caché desde la red.
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(staleWhileRevalidate(request, FONTS_CACHE));
    return;
  }

  // --- Filtro 3: recursos externos ---
  // Cualquier otro recurso de otro dominio no se toca.
  if (url.origin !== self.location.origin) return;

  // --- Caso B: Páginas HTML ---
  // "navigate" significa que el usuario está abriendo una página.
  // Estrategia RED PRIMERO: busca contenido fresco en internet; si no
  // hay conexión, usa el caché.
  if (request.mode === "navigate") {
    event.respondWith(
      // 1) Intenta traer la página de internet
      fetch(request)
        .then((respuesta) => {
          // Una respuesta solo se puede leer una vez, así que se hace
          // una copia para guardarla en caché
          const copia = respuesta.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, copia));
          // Entrega al usuario la versión fresca
          return respuesta;
        })
        // 2) Si falla la red (sin internet), busca en caché
        .catch(() =>
          caches
            // ignoreSearch ignora parámetros de la URL (ej. ?id=3)
            .match(request, { ignoreSearch: true })
            // 3) Si tampoco está en caché, devuelve index.html de respaldo
            .then((enCache) => enCache || caches.match("./index.html"))
        )
    );
    return;
  }

  // --- Caso C: CSS, JS, imágenes e íconos ---
  // Estrategia CACHÉ PRIMERO: carga instantánea. Si el archivo no está
  // en caché, lo pide a la red y lo guarda para la próxima vez.
  event.respondWith(
    caches.match(request).then(
      (enCache) =>
        // Si está en caché, se entrega; si no, se pide a la red
        enCache ||
        fetch(request).then((respuesta) => {
          // Solo se guardan respuestas exitosas (para no cachear
          // errores 404 o 500)
          if (respuesta.ok) {
            const copia = respuesta.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copia));
          }
          return respuesta;
        })
    )
  );
});


// ---------------------------------------------------------------------
// 6. FUNCIÓN AUXILIAR: precachearApi
// ---------------------------------------------------------------------

// Descarga la lista de misiones, el detalle de cada una (lectura y
// preguntas, SIN la respuesta correcta) y la línea de tiempo, y las guarda
// en el caché de la API. Son rutas públicas: no necesitan token.
async function precachearApi() {
  const cache = await caches.open(API_CACHE);
  const guardar = async (url) => {
    const respuesta = await fetch(url);
    if (respuesta.ok) await cache.put(url, respuesta.clone());
    return respuesta;
  };
  const misiones = await (await guardar("./api/index.php?r=misiones")).json();
  await Promise.all([
    guardar("./api/index.php?r=linea_tiempo"),
    ...misiones.map((m) => guardar(`./api/index.php?r=mision&codigo=${encodeURIComponent(m.codigo)}`))
  ]);
}


// ---------------------------------------------------------------------
// 7. FUNCIÓN AUXILIAR: staleWhileRevalidate
// ---------------------------------------------------------------------

// Devuelve lo que hay en caché y, a la vez, actualiza el caché desde la red.
// Así el recurso carga rápido y se mantiene actualizado para la siguiente
// visita.
//   - request:      la petición a resolver
//   - nombreCache:  el caché donde se guarda (ej. FONTS_CACHE)
function staleWhileRevalidate(request, nombreCache) {
  // Abre el caché indicado
  return caches.open(nombreCache).then((cache) =>
    // Busca si la petición ya está guardada
    cache.match(request).then((enCache) => {
      // Lanza la petición a internet en paralelo
      const desdeRed = fetch(request)
        .then((respuesta) => {
          // Cuando llega, actualiza el caché con la versión nueva
          // (se guarda una copia porque la respuesta se lee una sola vez)
          cache.put(request, respuesta.clone());
          return respuesta;
        })
        // Si falla la red, usa lo que había en caché
        // (OJO: si tampoco había caché, devuelve undefined y la fuente
        // simplemente no carga; no rompe la app)
        .catch(() => enCache);

      // Si ya había copia, responde AL INSTANTE con ella; si no, espera
      // a la red
      return enCache || desdeRed;
    })
  );
}