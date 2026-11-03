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

  const FALLBACK = [
    { id: "3542519", name: "(2010 PK9)", speed: 63532, distance: 20704610, diameterMin: 115, diameterMax: 258, date: "Dato NASA de respaldo", hazardous: true, jplUrl: "https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=3542519" },
    { id: "2000433", name: "433 Eros", speed: 24500, distance: 22200000, diameterMin: 16000, diameterMax: 36000, date: "Dato educativo de respaldo", hazardous: false, jplUrl: "https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=433" },
    { id: "2001036", name: "1036 Ganymed", speed: 31000, distance: 54000000, diameterMin: 28000, diameterMax: 62000, date: "Dato educativo de respaldo", hazardous: false, jplUrl: "https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=1036" }
  ];

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
  function dateKey() { return new Date().toLocaleDateString("en-CA"); }
  function api(route, params = {}) { const url = new URL(apiUrl); url.searchParams.set("r", route); Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v)); return url.href; }
  async function json(url, options = {}) { const response = await fetch(url, { headers: { Accept: "application/json", ...(options.headers || {}) }, ...options }); const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`); return payload; }
  function setStatus(type, label) { statusNode.classList.remove("api-live", "api-error"); statusNode.classList.add(type); statusNode.lastChild.textContent = ` ${label}`; }

  function normalize(neo) {
    const approach = neo.close_approach_data?.[0] || {};
    const meters = neo.estimated_diameter?.meters || {};
    return { id: String(neo.id), name: neo.name || "Objeto sin nombre", speed: Number(approach.relative_velocity?.kilometers_per_hour || 0), distance: Number(approach.miss_distance?.kilometers || 0), diameterMin: Number(meters.estimated_diameter_min || 0), diameterMax: Number(meters.estimated_diameter_max || 0), date: approach.close_approach_date_full || approach.close_approach_date || "Sin fecha", hazardous: Boolean(neo.is_potentially_hazardous_asteroid), jplUrl: neo.nasa_jpl_url || "https://ssd.jpl.nasa.gov/", orbit: null };
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
    await Promise.all(objects.slice(0, 8).map(async (object, index) => {
      try { object.orbit = parseOrbit(await json(api("nasa_orbit", { id: object.id })), object, index); }
      catch { object.orbit = pseudoOrbit(object, index); }
    }));
  }

  async function loadData(force = false) {
    refreshButton.disabled = true; message.textContent = "Consultando NASA NeoWs y JPL SBDB…"; setStatus("", "Consultando NASA");
    try {
      const payload = await json(api("nasa_feed", { fecha: dateKey(), forzar: force ? 1 : 0 }), { cache: force ? "reload" : "default" });
      const objects = Object.values(payload.near_earth_objects || {}).flat().map(normalize).sort((a, b) => a.distance - b.distance).slice(0, 8);
      if (!objects.length) throw new Error("NASA no devolvió objetos para hoy");
      await addOrbitalData(objects);
      state.objects = objects; state.selected = 0; renderList(); select(0, false); setStatus("api-live", "NASA conectada");
      const source = payload._novaquest?.fuente === "cache_api_nasa" ? "caché segura" : "NASA en tiempo real";
      message.textContent = `${objects.length} objetos obtenidos desde ${source}. Órbitas enriquecidas con NASA/JPL SBDB.`;
      updateNode.textContent = new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
    } catch (error) {
      state.objects = FALLBACK.map((o, i) => ({ ...o, orbit: pseudoOrbit(o, i) })); renderList(); select(0, false); setStatus("api-error", "Modo de respaldo"); message.textContent = `La conexión no respondió (${error.message}). El visor continúa con datos educativos almacenados.`;
    } finally { refreshButton.disabled = false; }
  }

  function renderList() {
    list.replaceChildren(); state.objects.forEach((object, index) => {
      const button = document.createElement("button"); button.type = "button"; button.className = "object-card";
      button.innerHTML = `<small>NQ—NEO ${String(index + 1).padStart(2, "0")}</small><h3></h3><p>${number.format(object.distance)} km</p><span>${object.hazardous ? "Vigilancia prioritaria" : "Observación NASA"}</span>`;
      button.querySelector("h3").textContent = object.name; button.addEventListener("click", () => select(index, true)); list.append(button);
    });
  }

  function select(index, open = true) {
    const object = state.objects[index]; if (!object) return; state.selected = index;
    detail.sequence.textContent = `NQ—NEO ${String(index + 1).padStart(2, "0")} · ${object.orbit?.source || "NASA"}`;
    detail.name.textContent = object.name; detail.summary.textContent = `${object.name} forma parte del registro de objetos cercanos a la Tierra. La visualización usa sus datos científicos para explicar su recorrido.`;
    detail.date.textContent = object.date; detail.distance.textContent = `${number.format(object.distance)} km`; detail.speed.textContent = `${number.format(object.speed)} km/h`; detail.diameter.textContent = `${number.format(object.diameterMin)}–${number.format(object.diameterMax)} m`;
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

  function b64ToArray(value) { const padding = "=".repeat((4 - value.length % 4) % 4); const raw = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(raw, (char) => char.charCodeAt(0)); }
  function arrayToB64(buffer) { let raw = ""; new Uint8Array(buffer).forEach((byte) => { raw += String.fromCharCode(byte); }); return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  function sameVapid(subscription, key) { const current = subscription?.options?.applicationServerKey; return Boolean(current && arrayToB64(current) === key.replace(/=+$/, "")); }
  async function currentSubscription() { return (await navigator.serviceWorker.ready).pushManager.getSubscription(); }

  async function inspectPush() {
    if (!("PushManager" in window) || !apiUrl) return;
    try {
      const [{ clave }, subscription] = await Promise.all([json(api("push_clave")), currentSubscription()]);
      if (!subscription) return;
      if (sameVapid(subscription, clave)) { notifyButton.textContent = "Notificaciones activas"; notifyButton.disabled = true; testButton.hidden = false; }
      else { notifyButton.textContent = "Reactivar notificaciones"; notifyButton.disabled = false; testButton.hidden = true; message.textContent = "Se detectó una suscripción de otro módulo. Reactívala para asociarla de forma segura a Órbita."; }
    } catch { /* La carga científica puede seguir aunque el diagnóstico push falle. */ }
  }

  async function activatePush() {
    if (!("Notification" in window) || !("PushManager" in window) || !("serviceWorker" in navigator)) throw new Error("Este navegador no admite Web Push.");
    const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
    if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone) throw new Error("En iPhone primero agrega NovaQuest a la pantalla de inicio y ábrela desde su icono.");
    if (await Notification.requestPermission() !== "granted") throw new Error("El permiso no fue concedido.");
    const registration = await navigator.serviceWorker.ready; const { clave } = await json(api("push_clave")); let subscription = await registration.pushManager.getSubscription();
    if (subscription && !sameVapid(subscription, clave)) { await json(api("push_baja"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint }) }).catch(() => {}); await subscription.unsubscribe(); subscription = null; }
    if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToArray(clave) });
    await json(api("push_suscribir"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(subscription.toJSON()) });
    notifyButton.textContent = "Notificaciones activas"; notifyButton.disabled = true; testButton.hidden = false; message.textContent = "Suscripción verificada con la clave de Órbita y registrada en push_nasa.";
  }

  let pushTimer;
  async function testPush() {
    const subscription = await currentSubscription(); if (!subscription) throw new Error("Primero activa las notificaciones."); testButton.disabled = true; message.textContent = "El servidor aceptará la prueba; esperando confirmación del Service Worker…";
    await json(api("push_prueba"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
    clearTimeout(pushTimer); pushTimer = setTimeout(() => { message.textContent = "El servidor aceptó el envío, pero este navegador no confirmó la recepción. Pulsa Reactivar notificaciones y revisa que el sistema permita avisos de NovaQuest."; testButton.disabled = false; }, 12000);
  }

  notifyButton.addEventListener("click", () => activatePush().catch((error) => { message.textContent = `No se pudo activar: ${error.message}`; }));
  testButton.addEventListener("click", () => testPush().catch((error) => { clearTimeout(pushTimer); testButton.disabled = false; message.textContent = `No se pudo enviar la prueba: ${error.message}`; }));
  navigator.serviceWorker?.addEventListener("message", (event) => { if (event.data?.type !== "novaquest-push-recibido") return; clearTimeout(pushTimer); testButton.disabled = false; message.textContent = "Prueba confirmada: el Service Worker recibió el Web Push y mostró la notificación."; });

  addEventListener("resize", resize); resize(); renderList(); select(0, false); requestAnimationFrame(frame); loadData(); inspectPush();
}
