// =====================================================================
// APORTACIÓN KEVIN: NOVAQUEST ÓRBITA
// Visor educativo inspirado en un planetario: NASA NeoWs aporta los datos
// de aproximación y NASA SBDB los elementos orbitales. Canvas dibuja una
// representación propia y ligera; no se copia código ni material de Eyes.
// =====================================================================

const canvas = document.querySelector("[data-orbit-canvas]");

if (canvas) {
  const ctx = canvas.getContext("2d");
  const list = document.querySelector("[data-object-list]");
  const message = document.querySelector("[data-data-message]");
  const statusNode = document.querySelector("[data-api-status]");
  const updateNode = document.querySelector("[data-update-time]");
  const panel = document.querySelector(".object-panel");
  const refreshButton = document.querySelector("[data-refresh-data]");
  const notifyButton = document.querySelector("[data-notify]");
  const testButton = document.querySelector("[data-test-notify]");
  const disableNotifyButton = document.querySelector("[data-disable-notify]");
  const pushMessage = document.querySelector("[data-push-message]");
  const config = window.NQ_KEVIN_CONFIG || {};
  const apiUrl = config.productionApiUrl || "";
  const number = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 });
  const decimal = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 });

  const detail = {
    sequence: document.querySelector("[data-object-sequence]"),
    name: document.querySelector("[data-object-name]"),
    summary: document.querySelector("[data-object-summary]"),
    speed: document.querySelector("[data-object-speed]"),
    distance: document.querySelector("[data-object-distance]"),
    diameter: document.querySelector("[data-object-diameter]"),
    date: document.querySelector("[data-object-date]"),
    hazard: document.querySelector("[data-hazard-note]"),
    link: document.querySelector("[data-jpl-link]")
  };

  // Catálogo únicamente visual para el modo sin conexión. No inventa
  // velocidades ni distancias: esos campos se muestran al recuperar NASA.
  const FALLBACK = [
    ["2000433", "433 Eros"], ["2101955", "101955 Bennu"],
    ["2162173", "162173 Ryugu"], ["2025143", "25143 Itokawa"],
    ["2099942", "99942 Apophis"], ["2065803", "65803 Didymos"],
    ["2004179", "4179 Toutatis"], ["2001036", "1036 Ganymed"],
    ["2015666", "1566 Icarus"], ["2001862", "1862 Apollo"]
  ].map(([id, name]) => ({
    id, name, speed: null, distance: null, diameterMin: null, diameterMax: null,
    date: "Disponible al reconectar", hazardous: false, fallback: true,
    imageUrl: null,
    jplUrl: `https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=${id}`
  }));

  const planets = [
    { name: "MERCURIO", a: .39, color: "#a7a9aa", size: 2.4, speed: 4.15 },
    { name: "VENUS", a: .72, color: "#d5a850", size: 3.5, speed: 1.62 },
    { name: "TIERRA", a: 1, color: "#43b9ff", size: 4.2, speed: 1 },
    { name: "MARTE", a: 1.52, color: "#bd5938", size: 3.2, speed: .53 },
    { name: "JÚPITER", a: 5.2, color: "#bd9476", size: 7.5, speed: .084 }
  ];

  const state = { objects: FALLBACK, selected: 0, width: 0, height: 0, dpr: 1, zoom: .83, panX: 0, panY: 0, rotation: -.18, dragging: false, pointerX: 0, pointerY: 0, hits: [], lastFrame: 0 };
  const stars = Array.from({ length: 650 }, (_, i) => ({ x: fract(Math.sin(i * 91.73) * 43758.5), y: fract(Math.sin(i * 37.21 + 2) * 12345.7), r: i % 23 === 0 ? 1.45 : .55 + (i % 5) * .09, a: .16 + (i % 9) * .055 }));
  const belt = Array.from({ length: 1100 }, (_, i) => ({ a: 2.05 + fract(Math.sin(i * 12.93) * 8931.7) * 1.35, angle: fract(Math.sin(i * 42.1 + 7) * 991.3) * Math.PI * 2, z: .35 + fract(Math.sin(i * 4.31) * 414.2) * .5, bright: i % 79 === 0 }));

  function fract(value) { return value - Math.floor(value); }
  function dateKey(offset = 0) {
    const now = new Date();
    now.setDate(now.getDate() + offset);
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }
  function api(route, params = {}) { const url = new URL(apiUrl); url.searchParams.set("r", route); Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v)); return url.href; }
  async function json(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeout || 10000);
    try {
      const { timeout: _timeout, ...fetchOptions } = options;
      const response = await fetch(url, { headers: { Accept: "application/json", ...(options.headers || {}) }, ...fetchOptions, signal: controller.signal });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
      return payload;
    } catch (error) {
      if (error.name === "AbortError") throw new Error("La consulta superó el tiempo de espera");
      throw error;
    } finally { clearTimeout(timeout); }
  }
  function setStatus(type, label) {
    statusNode.classList.remove("api-live", "api-error");
    if (type) statusNode.classList.add(type);
    statusNode.lastChild.textContent = ` ${label}`;
  }

  // NeoWs entrega datos científicos, no fotografías. Esta miniatura SVG
  // crea una representación educativa distinta para cada objeto. Si NASA
  // Images devuelve una coincidencia verificable, esa imagen la reemplaza.
  function proceduralAsteroid(object, index) {
    const palettes = [
      ["#c8b59b", "#6f5d4c", "#221c19"],
      ["#a9b7c2", "#526271", "#182029"],
      ["#c79b78", "#774b38", "#241713"],
      ["#b8b1a8", "#625d58", "#1d1b1a"]
    ];
    const shapes = [
      "M89 18C116 14 148 30 158 55C170 85 149 119 116 127C83 135 43 123 27 96C11 69 29 36 57 24C68 19 78 19 89 18Z",
      "M79 15C108 6 143 24 158 48C174 73 158 107 134 123C109 140 70 130 43 112C18 95 16 62 34 38C45 24 62 20 79 15Z",
      "M91 13C121 17 153 34 163 62C171 87 151 113 126 126C98 139 62 126 35 108C10 91 17 54 37 32C51 17 72 10 91 13Z",
      "M82 17C111 9 147 25 160 51C174 79 153 112 124 126C94 140 54 125 33 102C12 79 23 45 47 28C57 21 70 20 82 17Z"
    ];
    const seed = Number(String(object.id).slice(-5)) || index * 137;
    const palette = palettes[seed % palettes.length];
    const shape = shapes[seed % shapes.length];
    const craterA = 38 + seed % 52;
    const craterB = 76 + seed % 45;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 140">
      <defs>
        <radialGradient id="space"><stop stop-color="#172536"/><stop offset="1" stop-color="#03060a"/></radialGradient>
        <radialGradient id="rock" cx="32%" cy="24%"><stop stop-color="${palette[0]}"/><stop offset=".48" stop-color="${palette[1]}"/><stop offset="1" stop-color="${palette[2]}"/></radialGradient>
        <filter id="glow"><feGaussianBlur stdDeviation="5"/></filter>
      </defs>
      <rect width="180" height="140" fill="url(#space)"/>
      <g fill="#9deaff">${Array.from({ length: 12 }, (_, star) => `<circle cx="${(seed * (star + 7) * 17) % 176 + 2}" cy="${(seed + star * 31) % 132 + 4}" r="${star % 4 === 0 ? 1.1 : .45}" opacity="${.25 + (star % 5) * .12}"/>`).join("")}</g>
      <ellipse cx="92" cy="120" rx="58" ry="10" fill="#69d9ff" opacity=".13" filter="url(#glow)"/>
      <path d="${shape}" fill="url(#rock)" stroke="#dbe7ec" stroke-opacity=".18"/>
      <ellipse cx="${craterA}" cy="49" rx="14" ry="9" fill="#17191c" opacity=".48" transform="rotate(-18 ${craterA} 49)"/>
      <ellipse cx="${craterB}" cy="89" rx="10" ry="7" fill="#121417" opacity=".42" transform="rotate(24 ${craterB} 89)"/>
      <circle cx="118" cy="48" r="6" fill="#111419" opacity=".35"/>
      <path d="M48 35C69 19 103 19 126 32" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="3" stroke-linecap="round"/>
    </svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  function normalize(neo) {
    const approach = neo.close_approach_data?.[0] || {};
    const meters = neo.estimated_diameter?.meters || {};
    return { id: String(neo.id), name: neo.name || "Objeto sin nombre", speed: Number(approach.relative_velocity?.kilometers_per_hour || 0), distance: Number(approach.miss_distance?.kilometers || 0), diameterMin: Number(meters.estimated_diameter_min || 0), diameterMax: Number(meters.estimated_diameter_max || 0), date: approach.close_approach_date_full || approach.close_approach_date || "Sin fecha", hazardous: Boolean(neo.is_potentially_hazardous_asteroid), jplUrl: neo.nasa_jpl_url || "https://ssd.jpl.nasa.gov/", orbit: null, fallback: false, imageUrl: null };
  }

  function pseudoOrbit(object, index) {
    const seed = Number(String(object.id).slice(-6)) || index * 173;
    return { a: .82 + (seed % 350) / 100, e: .08 + ((seed >> 2) % 55) / 100, i: ((seed >> 3) % 28) * Math.PI / 180, node: ((seed * 17) % 360) * Math.PI / 180, peri: ((seed * 29) % 360) * Math.PI / 180, source: "aproximación visual" };
  }

  function parseOrbit(payload, object, index) {
    const elements = payload?.orbit?.elements || payload?.orbital_data || [];
    const value = (names) => { const hit = Array.isArray(elements) ? elements.find((item) => names.includes(item.name || item.label)) : null; return Number(hit?.value); };
    const a = value(["a", "semi-major axis"]), e = value(["e", "eccentricity"]), inc = value(["i", "inclination"]), node = value(["om", "ascending node"]), peri = value(["w", "perihelion argument"]);
    if (![a, e, inc].every(Number.isFinite)) return pseudoOrbit(object, index);
    return { a: Math.min(5.4, Math.max(.35, a)), e: Math.min(.82, Math.max(0, e)), i: inc * Math.PI / 180, node: (Number.isFinite(node) ? node : 0) * Math.PI / 180, peri: (Number.isFinite(peri) ? peri : 0) * Math.PI / 180, source: "NASA SBDB" };
  }

  async function addOrbitalData(objects) {
    let official = 0;
    await Promise.all(objects.map(async (object, index) => {
      try { object.orbit = parseOrbit(await json(api("nasa_orbit", { id: object.id }), { timeout: 4500 }), object, index); if (object.orbit.source === "NASA SBDB") official += 1; }
      catch { object.orbit = pseudoOrbit(object, index); }
    }));
    return official;
  }

  // NeoWs no contiene fotografías. Para no asociar una imagen genérica a
  // un objeto específico, NASA Images sólo se usa cuando el título o la
  // descripción contienen el nombre/designación buscada.
  async function addNasaImages(objects) {
    let found = 0;
    await Promise.all(objects.map(async (object) => {
      const cleanName = object.name.replace(/[()]/g, "").trim();
      const tokens = cleanName.toUpperCase().split(/\s+/).filter((token) => token.length >= 4 || /[A-Z]+\d|\d+[A-Z]+/.test(token));
      if (!tokens.length) return;
      try {
        const url = new URL("https://images-api.nasa.gov/search");
        url.searchParams.set("q", `asteroid ${cleanName}`);
        url.searchParams.set("media_type", "image");
        url.searchParams.set("page_size", "4");
        const payload = await json(url.href, { timeout: 5000 });
        const match = (payload.collection?.items || []).find((item) => {
          const metadata = item.data?.[0] || {};
          const haystack = `${metadata.title || ""} ${metadata.description || ""}`.toUpperCase();
          return tokens.some((token) => haystack.includes(token));
        });
        const image = match?.links?.find((link) => link.render === "image")?.href;
        if (image) { object.imageUrl = image; found += 1; }
      } catch { /* Una tarjeta procedural sigue disponible sin esta API. */ }
    }));
    renderList();
    select(state.selected, false);
    return found;
  }

  async function loadData(force = false) {
    refreshButton.disabled = true; message.textContent = "Consultando NASA NeoWs y JPL SBDB…"; setStatus("", "Consultando NASA");
    try {
      // Se consultan varios días a través del backend/caché para obtener una
      // selección manejable de diez objetos, como en la referencia de NASA.
      // Tres días suelen aportar más de diez objetos y evitan saturar la
      // cuota de NASA o ejecutar siete escrituras simultáneas en Supabase.
      const results = await Promise.allSettled(Array.from({ length: 3 }, (_, offset) =>
        json(api("nasa_feed", { fecha: dateKey(offset), forzar: force ? 1 : 0 }), { cache: force ? "reload" : "default", timeout: 14000 })
      ));
      const payloads = results.filter((result) => result.status === "fulfilled").map((result) => result.value);
      if (!payloads.length) throw new Error("NASA no devolvió datos para los próximos días");
      const unique = new Map();
      payloads.flatMap((payload) => Object.values(payload.near_earth_objects || {}).flat()).map(normalize).forEach((object) => {
        const previous = unique.get(object.id);
        if (!previous || object.distance < previous.distance) unique.set(object.id, object);
      });
      const objects = [...unique.values()].sort((a, b) => a.distance - b.distance).slice(0, 10);
      FALLBACK.forEach((fallback) => { if (objects.length < 10 && !objects.some((object) => object.id === fallback.id)) objects.push({ ...fallback }); });
      objects.forEach((object, index) => { object.orbit = pseudoOrbit(object, index); });
      state.objects = objects; state.selected = 0; renderList(); select(0, false); setStatus("api-live", "NASA conectada");
      const liveCount = objects.filter((object) => !object.fallback).length;
      message.textContent = `${liveCount} objetos próximos obtenidos de NASA; completando trayectorias e imágenes verificadas…`;
      updateNode.textContent = new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
      Promise.all([addOrbitalData(objects), addNasaImages(objects)]).then(([official, images]) => {
        select(state.selected, false);
        message.textContent = `${objects.length} objetos visibles · ${official} órbitas JPL/SBDB · ${images} imágenes coincidentes de NASA Images.`;
      });
    } catch (error) {
      state.objects = FALLBACK.map((o, i) => ({ ...o, orbit: pseudoOrbit(o, i) })); renderList(); select(0, false); setStatus("api-error", "Modo de respaldo"); message.textContent = `La conexión no respondió (${error.message}). El visor continúa con datos educativos almacenados.`;
    } finally { refreshButton.disabled = false; }
  }

  function renderList() {
    list.replaceChildren(); state.objects.forEach((object, index) => {
      const button = document.createElement("button"); button.type = "button"; button.className = "object-card";
      const thumb = document.createElement("span");
      thumb.className = "card-thumb";
      const generatedImage = proceduralAsteroid(object, index);
      const image = document.createElement("img");
      image.src = object.imageUrl || generatedImage;
      image.alt = object.imageUrl
        ? `Imagen NASA verificada de ${object.name}`
        : `Representación educativa de ${object.name}`;
      image.loading = "lazy";
      image.addEventListener("error", () => {
        if (image.src !== generatedImage) image.src = generatedImage;
      }, { once: true });
      thumb.dataset.kind = object.imageUrl ? "NASA" : "SIMULACIÓN";
      thumb.append(image);
      const copy = document.createElement("span");
      copy.className = "card-copy";
      copy.innerHTML = `<small>NQ—NEO ${String(index + 1).padStart(2, "0")}</small><h3></h3><p>${Number.isFinite(object.distance) ? `${number.format(object.distance)} km` : "Datos al reconectar"}</p><span>${object.fallback ? "Catálogo sin conexión" : object.hazardous ? "Vigilancia prioritaria" : "Observación NASA"}</span>`;
      copy.querySelector("h3").textContent = object.name;
      button.append(thumb, copy);
      button.addEventListener("click", () => select(index, true)); list.append(button);
    });
  }

  function select(index, open = true) {
    const object = state.objects[index]; if (!object) return; state.selected = index;
    detail.sequence.textContent = `NQ—NEO ${String(index + 1).padStart(2, "0")} · ${object.orbit?.source || "NASA"}`;
    detail.name.textContent = object.name; detail.summary.textContent = `${object.name} forma parte del registro de objetos cercanos a la Tierra. La visualización usa sus datos científicos para explicar su recorrido.`;
    detail.date.textContent = object.date;
    detail.distance.textContent = Number.isFinite(object.distance) ? `${number.format(object.distance)} km` : "Disponible con conexión";
    detail.speed.textContent = Number.isFinite(object.speed) ? `${number.format(object.speed)} km/h` : "Disponible con conexión";
    detail.diameter.textContent = Number.isFinite(object.diameterMin) && Number.isFinite(object.diameterMax) ? `${number.format(object.diameterMin)}–${number.format(object.diameterMax)} m` : "Disponible con conexión";
    detail.hazard.textContent = object.hazardous ? "NASA lo clasifica como potencialmente peligroso por tamaño y proximidad; esta clasificación no significa que vaya a impactar la Tierra." : "NASA no lo clasifica como potencialmente peligroso en la consulta actual.";
    detail.link.href = object.jplUrl; list.querySelectorAll(".object-card").forEach((card, i) => card.classList.toggle("active", i === index)); if (open) panel.classList.add("open");
  }

  function resize() { state.dpr = Math.min(devicePixelRatio || 1, 2); state.width = innerWidth; state.height = innerHeight; canvas.width = Math.round(state.width * state.dpr); canvas.height = Math.round(state.height * state.dpr); ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0); }
  function project(x, y) { const cos = Math.cos(state.rotation), sin = Math.sin(state.rotation); return { x: state.width * .51 + state.panX + (x * cos - y * sin), y: state.height * .47 + state.panY + (x * sin + y * cos) * .48 }; }
  function orbitPoint(orbit, theta, scale) { const radius = orbit.a * (1 - orbit.e * orbit.e) / (1 + orbit.e * Math.cos(theta)); const angle = theta + orbit.peri + orbit.node; return project(Math.cos(angle) * radius * scale, Math.sin(angle) * radius * scale * Math.cos(orbit.i)); }

  function drawBackground() { ctx.fillStyle = "#020409"; ctx.fillRect(0, 0, state.width, state.height); stars.forEach((star) => { ctx.globalAlpha = star.a; ctx.fillStyle = star.r > 1 ? "#9ceeff" : "#fff"; ctx.beginPath(); ctx.arc(star.x * state.width, star.y * state.height, star.r, 0, Math.PI * 2); ctx.fill(); }); ctx.globalAlpha = 1; }
  function drawOrbit(orbit, scale, color = "rgba(142,176,197,.22)", width = 1) { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); for (let step = 0; step <= 150; step++) { const p = orbitPoint(orbit, step / 150 * Math.PI * 2, scale); if (!step) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); } ctx.stroke(); }

  function drawSystem(time) {
    const usable = Math.max(420, state.height - 185), scale = Math.min(state.width, usable) * .145 * state.zoom;
    const center = project(0, 0); const glow = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, 48); glow.addColorStop(0, "#fffbd1"); glow.addColorStop(.16, "#ffe857"); glow.addColorStop(.45, "#ff9e16aa"); glow.addColorStop(1, "transparent"); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(center.x, center.y, 48, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#fff39d"; ctx.beginPath(); ctx.arc(center.x, center.y, 7, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#ffe872"; ctx.font = "600 9px IBM Plex Mono"; ctx.fillText("SOL", center.x + 13, center.y + 4);

    planets.forEach((planet, index) => {
      const orbit = { a: planet.a, e: 0, i: 0, node: 0, peri: 0 }; drawOrbit(orbit, scale, index === 2 ? "rgba(67,185,255,.38)" : "rgba(142,176,197,.2)");
      const angle = time * .00002 * planet.speed + index * 1.7; const point = orbitPoint(orbit, angle, scale); ctx.fillStyle = planet.color; ctx.shadowBlur = index === 2 ? 14 : 4; ctx.shadowColor = planet.color; ctx.beginPath(); ctx.arc(point.x, point.y, planet.size, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = planet.color; ctx.font = "600 8px IBM Plex Mono"; ctx.fillText(planet.name, point.x + 9, point.y + 3);
    });

    ctx.fillStyle = "#3387a8"; belt.forEach((rock) => { const p = project(Math.cos(rock.angle + time * .0000006) * rock.a * scale, Math.sin(rock.angle + time * .0000006) * rock.a * scale); ctx.globalAlpha = rock.z; ctx.beginPath(); ctx.arc(p.x, p.y, rock.bright ? 1.3 : .55, 0, Math.PI * 2); ctx.fill(); }); ctx.globalAlpha = 1;

    state.hits = []; state.objects.forEach((object, index) => {
      const orbit = object.orbit || pseudoOrbit(object, index); drawOrbit(orbit, scale, index === state.selected ? "rgba(215,255,72,.7)" : "rgba(203,219,229,.24)", index === state.selected ? 1.5 : .75);
      const theta = time * .000012 / Math.max(.5, orbit.a) + index * .83; const point = orbitPoint(orbit, theta, scale); const active = index === state.selected; ctx.fillStyle = object.hazardous ? "#ff7650" : "#d7ff48"; ctx.shadowBlur = active ? 22 : 8; ctx.shadowColor = ctx.fillStyle; ctx.beginPath(); ctx.arc(point.x, point.y, active ? 5.5 : 3.3, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; if (active) { ctx.strokeStyle = "#fff"; ctx.beginPath(); ctx.arc(point.x, point.y, 10, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = "#fff"; ctx.font = "600 10px IBM Plex Mono"; ctx.fillText(object.name, point.x + 15, point.y - 9); } state.hits.push({ x: point.x, y: point.y, index });
    });
  }

  function frame(time) { drawBackground(); drawSystem(time); requestAnimationFrame(frame); }
  function point(event) { return { x: event.clientX, y: event.clientY }; }
  canvas.addEventListener("pointerdown", (event) => { state.dragging = true; state.pointerX = event.clientX; state.pointerY = event.clientY; canvas.setPointerCapture(event.pointerId); });
  canvas.addEventListener("pointermove", (event) => { if (!state.dragging) return; const dx = event.clientX - state.pointerX, dy = event.clientY - state.pointerY; state.panX += dx; state.panY += dy; state.rotation += dx * .0008; state.pointerX = event.clientX; state.pointerY = event.clientY; });
  canvas.addEventListener("pointerup", (event) => { const p = point(event); const hit = state.hits.find((item) => Math.hypot(item.x - p.x, item.y - p.y) < 24); if (hit) select(hit.index, true); state.dragging = false; canvas.releasePointerCapture(event.pointerId); });
  canvas.addEventListener("pointercancel", () => { state.dragging = false; });
  canvas.addEventListener("wheel", (event) => { event.preventDefault(); state.zoom = Math.min(2.6, Math.max(.28, state.zoom * (event.deltaY > 0 ? .9 : 1.1))); }, { passive: false });
  document.querySelector("[data-zoom-in]").addEventListener("click", () => { state.zoom = Math.min(2.6, state.zoom * 1.18); });
  document.querySelector("[data-zoom-out]").addEventListener("click", () => { state.zoom = Math.max(.28, state.zoom / 1.18); });
  document.querySelector("[data-reset-view]").addEventListener("click", () => { state.zoom = .83; state.panX = 0; state.panY = 0; state.rotation = -.18; });
  document.querySelector("[data-panel-close]").addEventListener("click", () => panel.classList.remove("open"));
  refreshButton.addEventListener("click", () => loadData(true));

  // NOTIFICACIONES EN LÍNEA / COMPATIBILIDAD CON MIGUEL:
  // Se conserva una sola PushSubscription del navegador y se registra el
  // mismo endpoint en la tabla propia push_nasa alojada en Supabase.
  // Desactivar Órbita elimina únicamente su registro; no cancela la
  // suscripción compartida del sitio. No se usa PHP ni servidor local.
  const PUSH_FLAG = "nq_avisos_nasa";
  const pushSupported = "Notification" in window && "PushManager" in window && "serviceWorker" in navigator;
  const markPush = (active) => { try { active ? localStorage.setItem(PUSH_FLAG, "1") : localStorage.removeItem(PUSH_FLAG); } catch { /* almacenamiento opcional */ } };

  function b64ToArray(value) { const padding = "=".repeat((4 - value.length % 4) % 4); const raw = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(raw, (char) => char.charCodeAt(0)); }
  function sameVapid(subscription, keyBytes) { const current = subscription?.options?.applicationServerKey; if (!current) return true; const bytes = new Uint8Array(current); return bytes.length === keyBytes.length && bytes.every((byte, index) => byte === keyBytes[index]); }
  function registrationReady() { return Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => setTimeout(() => reject(new Error("El modo PWA no está listo. Recarga la página.")), 8000))]); }
  async function currentSubscription() { return (await registrationReady()).pushManager.getSubscription(); }
  function pushError(error) { return /push service error/i.test(error.message) ? "El navegador no pudo conectarse a su servicio Push. Revisa los permisos del navegador." : error.message; }

  function renderPush(active, text = "") {
    notifyButton.hidden = active || !pushSupported;
    notifyButton.disabled = false;
    testButton.hidden = !active;
    testButton.disabled = false;
    disableNotifyButton.hidden = !active;
    pushMessage.textContent = text;
  }

  async function subscriptionForOrbit(registration) {
    const [{ clave }, current] = await Promise.all([json(api("push_clave")), registration.pushManager.getSubscription()]);
    const keyBytes = b64ToArray(clave);
    if (current && sameVapid(current, keyBytes)) return current;
    if (current) {
      await json(api("push_baja"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: current.endpoint }) }).catch(() => {});
      await current.unsubscribe();
    }
    return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes });
  }

  async function inspectPush() {
    if (!pushSupported || !apiUrl || Notification.permission !== "granted") return renderPush(false);
    try {
      const registration = await registrationReady();
      const [{ clave }, current] = await Promise.all([json(api("push_clave")), registration.pushManager.getSubscription()]);
      if (!current) return renderPush(false);
      if (!sameVapid(current, b64ToArray(clave))) return renderPush(false, "La suscripción pertenece a otra clave. Activa nuevamente los avisos de Órbita.");
      await json(api("push_suscribir"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(current.toJSON()) });
      markPush(true);
      renderPush(true, "Avisos de Órbita activos en este dispositivo.");
    } catch { renderPush(false); }
  }

  async function activatePush() {
    if (!pushSupported) throw new Error("Este navegador no admite Web Push.");
    const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
    if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone) throw new Error("En iPhone primero agrega NovaQuest a la pantalla de inicio y ábrela desde su icono.");
    if (await Notification.requestPermission() !== "granted") throw new Error("El permiso no fue concedido.");
    const registration = await registrationReady();
    const subscription = await subscriptionForOrbit(registration);
    await json(api("push_suscribir"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(subscription.toJSON()) });
    markPush(true);
    renderPush(true, "Dispositivo registrado en Supabase. Usa «Enviar prueba» para comprobar el Web Push real.");
  }

  let pushTimer;
  async function testPush() {
    const subscription = await currentSubscription();
    if (!subscription) throw new Error("Primero activa las notificaciones.");
    testButton.disabled = true;
    pushMessage.textContent = "Servidor contactado; esperando confirmación del Service Worker…";
    await json(api("push_prueba"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => { pushMessage.textContent = "El servidor aceptó el envío, pero el dispositivo no confirmó la recepción. Reactiva los avisos y revisa los permisos del sistema."; testButton.disabled = false; }, 12000);
  }

  async function disablePush() {
    const subscription = await currentSubscription();
    if (subscription) await json(api("push_baja"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
    markPush(false);
    renderPush(false, "Avisos de Órbita desactivados. La suscripción compartida de NovaQuest se conserva.");
  }

  notifyButton.addEventListener("click", () => { notifyButton.disabled = true; activatePush().catch((error) => renderPush(false, `No se pudieron activar: ${pushError(error)}`)); });
  testButton.addEventListener("click", () => testPush().catch((error) => { clearTimeout(pushTimer); testButton.disabled = false; pushMessage.textContent = `No se pudo enviar: ${pushError(error)}`; }));
  disableNotifyButton.addEventListener("click", () => disablePush().catch((error) => { pushMessage.textContent = `No se pudo desactivar: ${pushError(error)}`; }));
  navigator.serviceWorker?.addEventListener("message", (event) => { if (event.data?.type !== "novaquest-push-recibido") return; clearTimeout(pushTimer); testButton.disabled = false; pushMessage.textContent = "Prueba confirmada: el Service Worker recibió y mostró la notificación."; });

  addEventListener("resize", resize); resize(); renderList(); select(0, false); requestAnimationFrame(frame); loadData(); inspectPush();
}
