// =====================================================================
// APORTACIÓN KEVIN: NQ Orbit Explorer
// Consume NASA NeoWs, adapta los datos para primaria y dibuja un globo
// interactivo ligero con Canvas. No modifica la lógica del juego de Miguel.
// =====================================================================

const canvas = document.querySelector("[data-orbit-canvas]");

if (canvas) {
  const context = canvas.getContext("2d");
  const canvasShell = document.querySelector("[data-canvas-shell]");
  const objectList = document.querySelector("[data-object-list]");
  const apiStatus = document.querySelector("[data-api-status]");
  const updateTime = document.querySelector("[data-update-time]");
  const dataMessage = document.querySelector("[data-data-message]");
  const refreshButton = document.querySelector("[data-refresh-data]");
  const notifyButton = document.querySelector("[data-notify]");

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

  const FALLBACK_OBJECTS = [
    {
      id: "3542519",
      name: "(2010 PK9)",
      speed: 63532.36,
      distance: 20704609.65,
      diameterMin: 115.49,
      diameterMax: 258.25,
      date: "2027-09-03",
      hazardous: true,
      jplUrl: "https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=3542519"
    },
    {
      id: "2000433",
      name: "433 Eros",
      speed: 24500,
      distance: 22200000,
      diameterMin: 16000,
      diameterMax: 36000,
      date: "Dato educativo de respaldo",
      hazardous: false,
      jplUrl: "https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=433"
    },
    {
      id: "2001036",
      name: "1036 Ganymed",
      speed: 31000,
      distance: 54000000,
      diameterMin: 28000,
      diameterMax: 62000,
      date: "Dato educativo de respaldo",
      hazardous: false,
      jplUrl: "https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=1036"
    }
  ];

  const state = {
    objects: FALLBACK_OBJECTS,
    selectedIndex: 0,
    markerPositions: [],
    rotation: -0.35,
    orbitOffset: 0,
    zoom: 1,
    dragging: false,
    pointerX: 0,
    width: 900,
    height: 680,
    lastFrame: 0
  };

  const number = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 });
  const decimal = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 });

  function localDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function setStatus(mode, text) {
    apiStatus.classList.remove("api-live", "api-cache", "api-error");
    apiStatus.classList.add(mode);
    apiStatus.lastChild.textContent = ` ${text}`;
  }

  function normalizeNeo(neo) {
    const approach = neo.close_approach_data?.[0] ?? {};
    const diameter = neo.estimated_diameter?.meters ?? {};
    return {
      id: String(neo.id),
      name: neo.name || "Objeto sin nombre",
      speed: Number(approach.relative_velocity?.kilometers_per_hour || 0),
      distance: Number(approach.miss_distance?.kilometers || 0),
      diameterMin: Number(diameter.estimated_diameter_min || 0),
      diameterMax: Number(diameter.estimated_diameter_max || 0),
      date: approach.close_approach_date_full || approach.close_approach_date || "Sin fecha",
      hazardous: Boolean(neo.is_potentially_hazardous_asteroid),
      jplUrl: neo.nasa_jpl_url || "https://ssd.jpl.nasa.gov/"
    };
  }

  async function loadNasaData({ force = false } = {}) {
    const date = localDateKey();
    const endpoint = `https://api.nasa.gov/neo/rest/v1/feed?start_date=${date}&end_date=${date}&api_key=DEMO_KEY`;
    refreshButton.disabled = true;
    dataMessage.textContent = "Consultando NASA NeoWs…";
    setStatus("api-cache", "Consultando NASA");

    try {
      const response = await fetch(endpoint, {
        headers: { Accept: "application/json" },
        cache: force ? "reload" : "default"
      });
      if (!response.ok) throw new Error(`NASA respondió ${response.status}`);

      const payload = await response.json();
      const objects = Object.values(payload.near_earth_objects || {})
        .flat()
        .map(normalizeNeo)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 8);

      if (!objects.length) throw new Error("NASA no devolvió objetos para la fecha consultada");

      state.objects = objects;
      state.selectedIndex = 0;
      renderObjectList();
      selectObject(0);
      setStatus("api-live", "NASA conectada");
      dataMessage.textContent = `${objects.length} objetos cargados desde NASA NeoWs para ${date}. La respuesta también queda disponible en la caché de la PWA.`;
      updateTime.textContent = `Actualizado ${new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}`;
    } catch (error) {
      state.objects = FALLBACK_OBJECTS;
      state.selectedIndex = 0;
      renderObjectList();
      selectObject(0);
      setStatus(navigator.onLine ? "api-error" : "api-cache", navigator.onLine ? "Respaldo educativo" : "Modo sin conexión");
      dataMessage.textContent = `No fue posible obtener una respuesta nueva (${error.message}). Se muestran datos educativos de respaldo para que el módulo siga funcionando.`;
      updateTime.textContent = "Datos de respaldo";
    } finally {
      refreshButton.disabled = false;
    }
  }

  function explainObject(object) {
    const size = object.diameterMax > 1000
      ? `${decimal.format(object.diameterMax / 1000)} km`
      : `${number.format(object.diameterMax)} m`;
    return `${object.name} es un objeto registrado por NASA. Su tamaño máximo estimado es de ${size}; la escena lo coloca cerca del planeta solo para facilitar la exploración.`;
  }

  function selectObject(index) {
    const object = state.objects[index];
    if (!object) return;
    state.selectedIndex = index;
    detail.sequence.textContent = `NQ—NEO ${String(index + 1).padStart(2, "0")}`;
    detail.name.textContent = object.name;
    detail.summary.textContent = explainObject(object);
    detail.speed.textContent = `${number.format(object.speed)} km/h`;
    detail.distance.textContent = `${number.format(object.distance)} km`;
    detail.diameter.textContent = `${number.format(object.diameterMin)}–${number.format(object.diameterMax)} m`;
    detail.date.textContent = object.date;
    detail.hazard.textContent = object.hazardous
      ? "NASA lo clasifica como potencialmente peligroso por criterios científicos de tamaño y cercanía. Esto no significa que vaya a impactar la Tierra."
      : "NASA no lo clasifica como potencialmente peligroso en la información consultada. La distancia de paso sigue siendo una estimación científica.";
    detail.link.href = object.jplUrl;
    objectList.querySelectorAll(".object-card").forEach((card, cardIndex) => {
      card.classList.toggle("active", cardIndex === index);
      card.setAttribute("aria-pressed", cardIndex === index ? "true" : "false");
    });
  }

  function renderObjectList() {
    objectList.replaceChildren();
    state.objects.forEach((object, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "object-card";
      button.setAttribute("aria-pressed", "false");

      const code = document.createElement("small");
      code.textContent = `NQ—NEO ${String(index + 1).padStart(2, "0")}`;
      const title = document.createElement("h3");
      title.textContent = object.name;
      const distance = document.createElement("p");
      distance.textContent = `${number.format(object.distance)} km de paso`;
      const classification = document.createElement("span");
      classification.textContent = object.hazardous ? "Clasificación: PHO" : "Clasificación: observación";

      button.append(code, title, distance, classification);
      button.addEventListener("click", () => selectObject(index));
      objectList.append(button);
    });
  }

  function resizeCanvas() {
    const rect = canvasShell.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    state.width = Math.max(320, rect.width);
    state.height = Math.max(440, rect.height);
    canvas.width = Math.round(state.width * ratio);
    canvas.height = Math.round(state.height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function drawStars() {
    context.fillStyle = "#060a18";
    context.fillRect(0, 0, state.width, state.height);
    for (let index = 0; index < 90; index += 1) {
      const x = (index * 137.5 + 31) % state.width;
      const y = (index * 83.3 + 17) % state.height;
      const size = index % 9 === 0 ? 1.8 : 0.8;
      context.globalAlpha = 0.25 + ((index * 17) % 60) / 100;
      context.fillStyle = index % 12 === 0 ? "#d8f34a" : "#ffffff";
      context.beginPath();
      context.arc(x, y, size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawGlobe(timestamp) {
    const centerX = state.width * 0.5;
    const centerY = state.height * 0.5;
    const radius = Math.min(state.width, state.height) * 0.27 * state.zoom;
    const pulse = Math.sin(timestamp * 0.001) * 4;

    const glow = context.createRadialGradient(centerX, centerY, radius * 0.8, centerX, centerY, radius * 1.55);
    glow.addColorStop(0, "rgba(33,85,245,0.18)");
    glow.addColorStop(0.6, "rgba(185,244,238,0.08)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    context.fillStyle = glow;
    context.beginPath();
    context.arc(centerX, centerY, radius * 1.55, 0, Math.PI * 2);
    context.fill();

    context.save();
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.clip();

    const ocean = context.createRadialGradient(
      centerX - radius * 0.38,
      centerY - radius * 0.42,
      radius * 0.08,
      centerX,
      centerY,
      radius * 1.05
    );
    ocean.addColorStop(0, "#75e6ff");
    ocean.addColorStop(0.35, "#1679cf");
    ocean.addColorStop(0.78, "#12346d");
    ocean.addColorStop(1, "#06122d");
    context.fillStyle = ocean;
    context.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);

    context.strokeStyle = "rgba(255,255,255,0.16)";
    context.lineWidth = 1;
    for (let latitude = -60; latitude <= 60; latitude += 30) {
      const y = centerY + Math.sin((latitude * Math.PI) / 180) * radius;
      const width = Math.cos((latitude * Math.PI) / 180) * radius;
      context.beginPath();
      context.ellipse(centerX, y, width, width * 0.12, 0, 0, Math.PI * 2);
      context.stroke();
    }
    for (let longitude = 0; longitude < 6; longitude += 1) {
      context.beginPath();
      context.ellipse(
        centerX,
        centerY,
        Math.max(8, Math.abs(Math.cos(state.rotation + longitude * Math.PI / 6)) * radius),
        radius,
        0,
        0,
        Math.PI * 2
      );
      context.stroke();
    }

    context.fillStyle = "rgba(128,206,102,0.88)";
    const continentShift = Math.sin(state.rotation) * radius * 0.32;
    context.beginPath();
    context.ellipse(centerX - radius * 0.25 + continentShift, centerY - radius * 0.16, radius * 0.26, radius * 0.38, -0.45, 0, Math.PI * 2);
    context.ellipse(centerX - radius * 0.05 + continentShift, centerY + radius * 0.28, radius * 0.14, radius * 0.31, 0.22, 0, Math.PI * 2);
    context.ellipse(centerX + radius * 0.35 + continentShift, centerY - radius * 0.08, radius * 0.35, radius * 0.22, 0.12, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "rgba(244,248,255,0.72)";
    context.beginPath();
    context.ellipse(centerX, centerY - radius * 0.92, radius * 0.52, radius * 0.12, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();

    context.strokeStyle = "rgba(216,243,74,0.42)";
    context.lineWidth = 1.5;
    context.setLineDash([5, 8]);
    context.beginPath();
    context.ellipse(centerX, centerY, radius * 1.58, radius * 0.62, -0.18, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);

    state.markerPositions = [];
    const total = Math.max(state.objects.length, 1);
    state.objects.forEach((object, index) => {
      const angle = state.orbitOffset + state.rotation * 0.42 + (index / total) * Math.PI * 2;
      const x = centerX + Math.cos(angle) * radius * 1.58;
      const y = centerY + Math.sin(angle) * radius * 0.62;
      const isSelected = index === state.selectedIndex;
      const isFront = Math.sin(angle) > -0.12;
      const markerRadius = (isSelected ? 9 : 6) + (isSelected ? pulse * 0.08 : 0);
      state.markerPositions.push({ x, y, index });

      context.globalAlpha = isFront ? 1 : 0.35;
      context.fillStyle = object.hazardous ? "#ff6846" : "#d8f34a";
      context.beginPath();
      context.arc(x, y, markerRadius, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = "rgba(255,255,255,0.8)";
      context.lineWidth = isSelected ? 3 : 1;
      context.beginPath();
      context.arc(x, y, markerRadius + 7, 0, Math.PI * 2);
      context.stroke();
      context.globalAlpha = 1;
    });
  }

  function animate(timestamp) {
    const elapsed = Math.min(32, timestamp - state.lastFrame || 16);
    state.lastFrame = timestamp;
    if (!state.dragging && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      state.orbitOffset += elapsed * 0.000035;
    }
    drawStars();
    drawGlobe(timestamp);
    requestAnimationFrame(animate);
  }

  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  canvas.addEventListener("pointerdown", (event) => {
    state.dragging = true;
    state.pointerX = event.clientX;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!state.dragging) return;
    const delta = event.clientX - state.pointerX;
    state.rotation += delta * 0.009;
    state.pointerX = event.clientX;
  });
  canvas.addEventListener("pointerup", (event) => {
    const point = pointerPosition(event);
    const hit = state.markerPositions.find((marker) => Math.hypot(marker.x - point.x, marker.y - point.y) < 24);
    if (hit) selectObject(hit.index);
    state.dragging = false;
    canvas.releasePointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointercancel", () => {
    state.dragging = false;
  });
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    state.zoom = Math.min(1.35, Math.max(0.72, state.zoom - Math.sign(event.deltaY) * 0.08));
  }, { passive: false });

  document.querySelector("[data-zoom-in]").addEventListener("click", () => {
    state.zoom = Math.min(1.35, state.zoom + 0.1);
  });
  document.querySelector("[data-zoom-out]").addEventListener("click", () => {
    state.zoom = Math.max(0.72, state.zoom - 0.1);
  });
  document.querySelector("[data-reset-view]").addEventListener("click", () => {
    state.rotation = -0.35;
    state.orbitOffset = 0;
    state.zoom = 1;
  });

  refreshButton.addEventListener("click", () => loadNasaData({ force: true }));
  notifyButton.addEventListener("click", async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      dataMessage.textContent = "Este navegador no permite notificaciones de la PWA.";
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      dataMessage.textContent = "El permiso de notificaciones no fue concedido.";
      return;
    }
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification("NovaQuest · Radar NASA", {
      body: "La beta de NQ Orbit Explorer está lista para consultar objetos cercanos a la Tierra.",
      icon: "assets/icons/icon-192.png",
      badge: "assets/icons/icon-192.png",
      tag: "novaquest-kevin-nasa",
      data: { url: "./explorador.html" }
    });
    dataMessage.textContent = "Aviso local enviado. El push remoto requerirá un servicio backend con suscripciones Web Push.";
  });

  new ResizeObserver(resizeCanvas).observe(canvasShell);
  renderObjectList();
  selectObject(0);
  resizeCanvas();
  requestAnimationFrame(animate);
  loadNasaData();
}
