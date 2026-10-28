// Cadetes NovaQuest: lee una misión y juega con lo leído.
// Usa la API (api/index.php) a través de js/api.js (objeto NQ).
(() => {
  "use strict";

  const AVATARES = { astronauta: "🧑‍🚀", cohete: "🚀", satelite: "🛰️", luna: "🌙", estrella: "⭐", tierra: "🌍" };
  const INSIGNIAS = { primera_mision: "Astronauta novato", explorador: "Explorador", cientifico: "Científico" };

  const $ = (selector) => document.querySelector(selector);
  const leer = (clave) => { try { return localStorage.getItem(clave); } catch { return null; } };
  const guardar = (clave, valor) => { try { localStorage.setItem(clave, valor); } catch { /* sin almacenamiento */ } };
  const borrarSesion = () => { try { ["nq_token", "nq_apodo", "nq_avatar", "nq_grupo"].forEach((k) => localStorage.removeItem(k)); } catch { /* nada */ } };

  // Crea elementos sin innerHTML: el texto de la API siempre entra como texto.
  function el(etiqueta, atributos = {}, ...hijos) {
    const nodo = document.createElement(etiqueta);
    for (const [clave, valor] of Object.entries(atributos)) {
      if (clave === "class") nodo.className = valor;
      else if (clave === "text") nodo.textContent = valor;
      else nodo.setAttribute(clave, valor);
    }
    hijos.forEach((hijo) => nodo.append(hijo));
    return nodo;
  }

  const pantallas = ["registro", "misiones", "lectura", "juego", "final"];
  function mostrar(nombre) {
    pantallas.forEach((p) => { $(`#pantalla-${p}`).hidden = p !== nombre; });
    $(".juego-hero").hidden = nombre === "juego";
    if (nombre !== "juego") pantallaGrande(false);
    if (nave && nombre !== "juego") nave.detener();
    // Lleva la vista y el foco al encabezado de la pantalla nueva (accesibilidad)
    const titulo = $(`#pantalla-${nombre}`).querySelector("h2");
    titulo.setAttribute("tabindex", "-1");
    titulo.focus({ preventScroll: true });
    $(".juego-zona").scrollIntoView({ block: "start" });
  }

  function aviso(mensaje, tipo = "error") {
    const caja = $("[data-aviso]");
    caja.textContent = mensaje || "";
    caja.className = "juego-aviso" + (tipo === "ok" ? " ok" : "");
    caja.hidden = !mensaje;
  }

  function mensajeDeError(error) {
    if (error instanceof TypeError) return "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.";
    if (error instanceof SyntaxError) return "El servidor no respondió como se esperaba.";
    return error.message || "Algo salió mal.";
  }

  const estado = { mision: null, preguntas: [], indice: 0, puntos: 0, insignias: [], ultima: null, progreso: null };
  let nave = null;

  // ---------- Jugador ----------
  async function actualizarJugador(refrescar = true) {
    const apodo = leer("nq_apodo");
    if (!apodo) { $("[data-jugador]").textContent = "Sin sesión"; $("[data-salir]").hidden = true; return; }
    let total = "";
    try {
      if (refrescar || !estado.progreso) estado.progreso = await NQ.progreso();
      const suma = [...estado.progreso.misiones, ...estado.progreso.etapas].reduce((t, x) => t + Number(x.puntos), 0);
      total = ` · ${suma} pts`;
    } catch { /* se muestra sin puntos */ }
    $("[data-jugador]").textContent = `${AVATARES[leer("nq_avatar")] || "🧑‍🚀"} ${apodo}${total}`;
    $("[data-salir]").hidden = false;
  }

  // ---------- Registro ----------
  $("[data-registro]").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    const grupo = String(datos.get("grupo")).trim().toUpperCase();
    const apodo = String(datos.get("apodo")).trim();
    const avatar = String(datos.get("avatar"));
    try {
      const respuesta = await NQ.registrar(grupo, apodo, avatar);
      guardar("nq_apodo", respuesta.apodo);
      guardar("nq_avatar", respuesta.avatar);
      guardar("nq_grupo", grupo);
      aviso("");
      estado.progreso = null;
      await mostrarMisiones();
    } catch (error) {
      aviso(mensajeDeError(error));
    }
  });

  $("[data-salir]").addEventListener("click", () => {
    borrarSesion();
    estado.progreso = null;
    actualizarJugador();
    mostrar("registro");
  });

  // ---------- Misiones ----------
  async function mostrarMisiones() {
    try {
      const [misiones] = await Promise.all([NQ.misiones(), actualizarJugador()]);
      const hechas = new Set((estado.progreso?.misiones || []).filter((m) => m.estado === "completada").map((m) => m.codigo));
      const lista = $("[data-lista-misiones]");
      lista.replaceChildren(...misiones.map((m) => {
        const boton = el("button", { type: "button", text: hechas.has(m.codigo) ? "Jugar otra vez" : "Jugar" });
        boton.addEventListener("click", () => abrirMision(m.codigo));
        return el("article", { class: "mision-card" },
          el("img", { src: m.imagen, alt: "", loading: "lazy" }),
          el("div", {},
            el("small", { text: `${m.codigo} · ${m.tipo}` }),
            el("h3", { text: m.titulo }),
            el("p", { text: m.resumen }),
            hechas.has(m.codigo) ? el("span", { class: "estado hecha", text: "✔ Completada" }) : el("span", { class: "estado", text: m.nivel }),
            boton));
      }));
      mostrar("misiones");
    } catch (error) {
      aviso(mensajeDeError(error));
    }
  }

  // ---------- Lectura ----------
  async function abrirMision(codigo) {
    try {
      const mision = await NQ.mision(codigo);
      const articulo = mision.articulos[0];
      const preguntas = mision.articulos.flatMap((a) => a.preguntas);
      if (!articulo || preguntas.length === 0) {
        aviso("Esta misión estará lista muy pronto. ¡Mientras tanto prueba la Estación Espacial Internacional!");
        return;
      }
      aviso("");
      Object.assign(estado, { mision, preguntas, indice: 0, puntos: 0, insignias: [], ultima: null });
      $("[data-lectura-codigo]").textContent = `${mision.codigo} / ${mision.titulo}`;
      $("[data-lectura-titulo]").textContent = articulo.titulo;
      $("[data-lectura-texto]").textContent = articulo.contenido;
      mostrar("lectura");
    } catch (error) {
      aviso(mensajeDeError(error));
    }
  }

  // ---------- Juego de naves ----------
  function actualizarHud(h) {
    $("[data-hud-vidas]").textContent = "❤️".repeat(h.vidas) + "🖤".repeat(3 - h.vidas);
    $("[data-hud-vidas]").setAttribute("aria-label", `${h.vidas} escudos`);
    $("[data-hud-puntos]").textContent = h.puntos;
    $("[data-pregunta-contador]").textContent = `PREGUNTA ${Math.min(h.indice + 1, h.total)} DE ${h.total}`;
    $("[data-pregunta-texto]").textContent = h.texto;
  }

  // Dato curioso que aparece sobre el juego al acertar
  let temporizadorDato = 0;
  function mostrarDato(texto) {
    const d = $("[data-dato]");
    d.textContent = "💡 " + texto;
    d.hidden = false;
    d.classList.remove("sale"); void d.offsetWidth; d.classList.add("sale");
    clearTimeout(temporizadorDato);
    temporizadorDato = setTimeout(() => { d.hidden = true; }, 6500);
  }

  let tipoOverlay = "inicio";
  function overlay(tipo) {
    tipoOverlay = tipo;
    const secundario = $("[data-overlay-secundario]");
    if (tipo === "inicio") {
      $("[data-overlay-titulo]").textContent = estado.mision.titulo;
      $("[data-overlay-texto]").textContent = "Los alienígenas comandantes llevan las respuestas: dispara al que tenga la correcta. Si te equivocas o te alcanza un disparo, pierdes un escudo.";
      $("[data-overlay-boton]").textContent = "¡Despegar!";
      secundario.hidden = true;
    } else {
      $("[data-overlay-titulo]").textContent = "¡Tu nave se dañó!";
      $("[data-overlay-texto]").textContent = "Los cadetes siempre lo intentan otra vez. Repasa la lectura si lo necesitas.";
      $("[data-overlay-boton]").textContent = "Intentar otra vez";
      secundario.textContent = "Repasar lectura";
      secundario.hidden = false;
    }
    $("[data-overlay]").hidden = false;
    $("[data-overlay-boton]").focus({ preventScroll: true });
  }

  $("[data-overlay-boton]").addEventListener("click", () => {
    $("[data-overlay]").hidden = true;
    if (tipoOverlay === "perdio") nave.reintentar(); else nave.despegar();
  });

  // Repasar la lectura sin salir del juego (el juego se pausa)
  const dialogo = $("[data-dialogo]");
  function abrirRepaso() {
    const articulo = estado.mision.articulos[0];
    $("[data-dialogo-titulo]").textContent = articulo.titulo;
    $("[data-dialogo-texto]").textContent = articulo.contenido;
    if (nave) nave.pausar();
    dialogo.showModal();
  }
  $("[data-overlay-secundario]").addEventListener("click", abrirRepaso);
  $("[data-repasar]").addEventListener("click", abrirRepaso);
  $("[data-dialogo-cerrar]").addEventListener("click", () => dialogo.close());
  dialogo.addEventListener("close", () => { if (nave) nave.reanudar(); });

  $("[data-sonido]").addEventListener("click", (evento) => {
    const boton = evento.currentTarget;
    const activo = boton.getAttribute("aria-pressed") !== "true";
    boton.setAttribute("aria-pressed", String(activo));
    boton.textContent = activo ? "🔊" : "🔇";
    if (nave) nave.sonido(activo);
  });

  // Pantalla grande: usa pantalla completa si el navegador lo permite; si no (iPhone),
  // el panel del juego cubre toda la ventana.
  const panelJuego = $("#pantalla-juego");
  const botonGrande = $("[data-grande]");
  function pantallaGrande(activa) {
    if (panelJuego.classList.contains("completa") === activa) return;
    panelJuego.classList.toggle("completa", activa);
    botonGrande.setAttribute("aria-pressed", String(activa));
    botonGrande.textContent = activa ? "✕ Salir" : "⛶ Grande";
    document.body.style.overflow = activa ? "hidden" : "";
    try {
      if (activa && panelJuego.requestFullscreen) panelJuego.requestFullscreen().catch(() => {});
      else if (!activa && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    } catch { /* sin pantalla completa */ }
  }
  botonGrande.addEventListener("click", () => pantallaGrande(!panelJuego.classList.contains("completa")));
  document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement) pantallaGrande(false); });

  function despegar() {
    if (!nave) {
      nave = Nave.crear($("[data-canvas]"), {
        // Cada disparo a una cápsula se califica en el servidor
        responder: (opcionId) => NQ.responder(opcionId),
        alRespuesta: (r) => {
          estado.ultima = r; estado.insignias.push(...r.insignias_nuevas);
          if (r.correcta && r.explicacion) mostrarDato(r.explicacion);
        },
        alHud: actualizarHud,
        alTerminar: (info) => { estado.puntos = info.puntos; estado.resumen = info; mostrarFinal(); },
        alPerder: () => overlay("perdio"),
        alError: (error) => aviso(mensajeDeError(error))
      });
    }
    aviso("");
    mostrar("juego");
    const m = estado.mision;
    nave.cargar(estado.preguntas, 0, /\bsol\b/i.test(m.titulo) ? "sol" : m.categoria);
    overlay("inicio");
  }

  // ---------- Resultado ----------
  async function mostrarFinal() {
    const completada = Boolean(estado.ultima?.completada);
    $("[data-final-titulo]").textContent = completada ? "¡Misión cumplida!" : "¡Terminaste las preguntas!";
    $("[data-final-puntos]").textContent = estado.puntos;
    const r = estado.resumen || { vidas: 1, fallos: 0, racha: 0, aliens: 0 };
    const estrellas = r.vidas >= 3 ? 3 : r.vidas === 2 ? 2 : 1;
    $("[data-final-estrellas]").textContent = "⭐".repeat(estrellas) + "☆".repeat(3 - estrellas);
    $("[data-final-estrellas]").setAttribute("aria-label", `${estrellas} de 3 estrellas`);
    $("[data-final-detalle]").textContent = `Escudos perdidos: ${r.fallos} · Mejor racha: ${r.racha} · Alienígenas derribados: ${r.aliens}`;
    $("[data-final-insignias]").replaceChildren(...estado.insignias.map((codigo) =>
      el("span", { class: "insignia", text: `🏅 ${INSIGNIAS[codigo] || codigo}` })));
        mostrar("final");
    actualizarJugador();
    try {
      const filas = await NQ.llamar("ranking", { params: { codigo_grupo: leer("nq_grupo") || "" } });
      const yo = leer("nq_apodo");
      $("[data-ranking]").replaceChildren(...filas.map((f) =>
        el("li", { class: f.apodo === yo ? "yo" : "" },
          el("span", { text: `${AVATARES[f.avatar] || "🧑‍🚀"} ${f.apodo}` }),
          el("span", { text: `${f.puntos} pts` }))));
    } catch { /* el ranking es opcional */ }
  }

  document.querySelectorAll("[data-volver]").forEach((b) => b.addEventListener("click", mostrarMisiones));
  $("[data-ir-preguntas]").addEventListener("click", despegar);

  // ---------- Inicio ----------
  async function iniciar() {
    if (!leer("nq_token")) { mostrar("registro"); return; }
    try {
      estado.progreso = await NQ.progreso();
    } catch (error) {
      if (/token/i.test(error.message)) {
        // El servidor rechazó el token: se pide registrarse de nuevo
        borrarSesion();
        await actualizarJugador();
        mostrar("registro");
        return;
      }
      // Sin conexión u otro fallo: se conserva la sesión y se intenta con lo guardado
      aviso(error instanceof TypeError
        ? "Estás sin conexión. Puedes leer las misiones guardadas; para calificar tus respuestas y sumar puntos necesitas internet."
        : mensajeDeError(error));
    }
    await actualizarJugador(false);
    await mostrarMisiones();
  }
  iniciar();
})();
