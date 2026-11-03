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

  // Copia revuelta de una lista (Fisher-Yates)
  function revolver(lista) {
    const copia = [...lista];
    for (let i = copia.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    return copia;
  }

  // Convierte una lectura en un artículo: "## " subtítulo, "- " lista, "> " recuadro
  // "¿Sabías que...?", **negritas** y una línea en blanco entre párrafos.
  // Todo entra como texto (sin innerHTML), así la base de datos no puede meter código.
  function conNegritas(nodo, texto) {
    texto.split("**").forEach((parte, i) => { if (parte) nodo.append(i % 2 ? el("strong", { text: parte }) : parte); });
    return nodo;
  }
  function articuloHTML(texto) {
    return String(texto || "").replace(/\r/g, "").split(/\n\s*\n/).map((bloque) => bloque.trim()).filter(Boolean).flatMap((bloque) => {
      const lineas = bloque.split("\n");
      const nodos = [];
      // Un subtítulo puede venir pegado al párrafo que le sigue
      if (lineas[0].startsWith("## ")) nodos.push(el("h3", { class: "articulo-subtitulo", text: lineas.shift().slice(3) }));
      if (!lineas.length) return nodos;
      const lista = lineas.filter((l) => l.startsWith("- "));
      if (bloque.startsWith("> ")) {
        const texto = lineas.join(" ").slice(2);
        const [, titulo = "", resto = texto] = texto.match(/^(¿Sabías que\.\.\.\?)\s*(.*)$/) || [];
        nodos.push(conNegritas(el("aside", { class: "articulo-sabias" }, titulo ? el("strong", { text: "💡 " + titulo + " " }) : ""), resto));
      } else if (lista.length) {
        // Párrafo que presenta la lista (si lo hay) y luego la lista
        const intro = lineas.filter((l) => !l.startsWith("- ")).join(" ");
        if (intro) nodos.push(conNegritas(el("p"), intro));
        nodos.push(el("ul", { class: "articulo-lista" }, ...lista.map((l) => conNegritas(el("li"), l.slice(2)))));
      } else {
        nodos.push(conNegritas(el("p"), lineas.join(" ")));
      }
      return nodos;
    });
  }
  // Minutos de lectura para un niño (unas 120 palabras por minuto)
  const minutosDeLectura = (texto) => Math.max(1, Math.round(String(texto || "").split(/\s+/).length / 120));

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
    if (nombre !== "juego" && dialogo.open) dialogo.close(); // "atrás" con el repaso abierto
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

  // Todas las misiones usan el juego de naves (js/juego/nave.js); lo que cambia es
  // el escenario de cada una: el lugar, el fondo, los enemigos y la dificultad.
  const ESCENARIO_DE = { "NQ-01": "tierra", "NQ-02": "luna", "NQ-03": "estacion", "NQ-04": "satelites", "NQ-05": "sol", "NQ-06": "estrellas" };
  const escenarioDe = (codigo) => (Nave.ESCENARIOS[ESCENARIO_DE[codigo]] ? ESCENARIO_DE[codigo] : "estacion");
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
      // Reemplaza: "atrás" ya no regresa al formulario de registro
      reemplazar("misiones");
    } catch (error) {
      aviso(mensajeDeError(error));
    }
  });

  $("[data-salir]").addEventListener("click", async () => {
    // Antes de borrar el token: este navegador deja de recibir avisos del cadete
    await AvisosJuego.olvidar();
    borrarSesion();
    estado.progreso = null;
    actualizarJugador();
    reemplazar("registro");
  });

  // ---------- Misiones ----------
  async function mostrarMisiones(miTurno) {
    try {
      const [misiones] = await Promise.all([NQ.misiones(), actualizarJugador()]);
      if (miTurno !== turno) return; // el niño ya se fue a otra pantalla
      const hechas = new Set((estado.progreso?.misiones || []).filter((m) => m.estado === "completada").map((m) => m.codigo));
      const lista = $("[data-lista-misiones]");
      lista.replaceChildren(...misiones.map((m) => {
        const boton = el("button", { type: "button", text: hechas.has(m.codigo) ? "Jugar otra vez" : "Jugar" });
        boton.addEventListener("click", () => ir(`mision/${m.codigo}`));
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
      AvisosJuego.revisar();
    } catch (error) {
      aviso(mensajeDeError(error));
    }
  }

  // ---------- Lectura ----------
  // Carga la misión y llena la lectura. Devuelve false si no se puede jugar.
  async function abrirMision(codigo) {
    try {
      const mision = await NQ.mision(codigo);
      const articulo = mision.articulos[0];
      // En la BD la opción correcta suele ser la primera: se revuelven para
      // que no se pueda adivinar por su lugar
      const preguntas = mision.articulos.flatMap((a) => a.preguntas)
        .map((p) => ({ ...p, opciones: revolver(p.opciones) }));
      if (!articulo || preguntas.length === 0) {
        aviso("Esta misión estará lista muy pronto. ¡Mientras tanto prueba la Estación Espacial Internacional!");
        return false;
      }
      aviso("");
      Object.assign(estado, { mision, preguntas, indice: 0, puntos: 0, insignias: [], ultima: null, resumen: null });
      // Para calificar sin conexión hay que saber de qué pregunta es cada opción
      estado.preguntaDe = new Map(preguntas.flatMap((p) => p.opciones.map((o) => [o.id, p])));
      estado.acertadasSinRed = new Set();
      $("[data-lectura-codigo]").textContent = `${mision.codigo} / ${mision.titulo}`;
      $("[data-lectura-titulo]").textContent = articulo.titulo;
      $("[data-lectura-texto]").replaceChildren(...articuloHTML(articulo.contenido));
      $("[data-lectura-tiempo]").textContent = `⏱ ${minutosDeLectura(articulo.contenido)} min de lectura · Lee con calma: las preguntas del juego salen de aquí`;
      return true;
    } catch (error) {
      aviso(mensajeDeError(error));
      return false;
    }
  }

  // ---------- Juego de naves ----------
  function actualizarHud(h) {
    $("[data-hud-vidas]").textContent = "❤️".repeat(h.vidas) + "🖤".repeat(3 - h.vidas);
    $("[data-hud-vidas]").setAttribute("aria-label", `${h.vidas} escudos`);
    $("[data-hud-puntos]").textContent = h.puntos;
    $("[data-pregunta-contador]").textContent = h.jefe ? "⚠ JEFE FINAL" : `PREGUNTA ${Math.min(h.indice + 1, h.total)} DE ${h.total}`;
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
      const esc = Nave.ESCENARIOS[escenarioDe(estado.mision.codigo)];
      $("[data-overlay-texto]").textContent = `${esc.intro} ${esc.intro2 || ""} Los alienígenas comandantes llevan las respuestas: dispara al que tenga la correcta. Al final te espera un jefe: ${esc.jefe.nombre}. ¡Derrótalo para ganar puntos extra!`;
      $("[data-overlay-boton]").textContent = "¡Despegar!";
      secundario.hidden = true;
    } else if (tipo === "jefe") {
      // Perdió contra el jefe final: las preguntas ya están contestadas
      $("[data-overlay-titulo]").textContent = "¡El jefe dañó tu nave!";
      $("[data-overlay-texto]").textContent = "Ya contestaste todas las preguntas. Puedes pelear otra vez contra el jefe por los puntos extra, o terminar la misión.";
      $("[data-overlay-boton]").textContent = "Pelear otra vez";
      secundario.textContent = "Terminar la misión";
      secundario.hidden = false;
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
    if (tipoOverlay === "perdio" || tipoOverlay === "jefe") nave.reintentar(); else nave.despegar();
  });

  // Repasar la lectura sin salir del juego (el juego se pausa)
  const dialogo = $("[data-dialogo]");
  function abrirRepaso() {
    const articulo = estado.mision.articulos[0];
    $("[data-dialogo-titulo]").textContent = articulo.titulo;
    $("[data-dialogo-texto]").replaceChildren(...articuloHTML(articulo.contenido));
    if (nave) nave.pausar();
    dialogo.showModal();
  }
  $("[data-overlay-secundario]").addEventListener("click", () => {
    if (tipoOverlay !== "jefe") return abrirRepaso();
    $("[data-overlay]").hidden = true;
    nave.rendirse();
  });
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
    if (!nave) nave = Nave.crear($("[data-canvas]"), callbacksDelJuego());
    aviso("");
    mostrar("juego");
    nave.cargar(estado.preguntas, 0, escenarioDe(estado.mision.codigo));
    overlay("inicio");
  }

  function callbacksDelJuego() {
    return {
      // Cada disparo a una cápsula se califica en el servidor (o aquí, sin conexión)
      responder: responderJuego,
      alRespuesta: (r) => {
        estado.ultima = r; estado.insignias.push(...r.insignias_nuevas);
        r.insignias_nuevas.forEach((codigo) =>
          AvisosJuego.local(`🏅 ¡Insignia nueva: ${INSIGNIAS[codigo] || codigo}!`, "La puedes ver al terminar la misión."));
        if (r.correcta && r.explicacion) mostrarDato(r.explicacion);
      },
      alHud: actualizarHud,
      alTerminar: (info) => {
        // Si el niño ya salió del juego (atrás), no se le cambia la pantalla
        if (!rutaActual().startsWith("jugar/")) return;
        estado.puntos = info.puntos; estado.resumen = info;
        // Reemplaza: "atrás" desde el resultado no regresa a un juego terminado
        reemplazar("resultado");
      },
      alPerder: (info) => overlay(info?.jefe ? "jefe" : "perdio"),
      alJefe: () => jefeDerrotado(estado.mision.codigo),
      alError: (error) => aviso(mensajeDeError(error))
    };
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
    const extra = r.extra ?? `Alienígenas derribados: ${r.aliens}`;
    const jefe = r.jefe ? (r.jefe.derrotado ? `👾 ${r.jefe.nombre} derrotado${r.jefe.bono ? ` (+${r.jefe.bono} pts extra)` : ""}` : `👾 ${r.jefe.nombre} escapó`) : "";
    $("[data-final-detalle]").textContent = [`Escudos perdidos: ${r.fallos}`, `Mejor racha: ${r.racha}`, extra, jefe].filter(Boolean).join(" · ");
    $("[data-final-insignias]").replaceChildren(...estado.insignias.map((codigo) =>
      el("span", { class: "insignia", text: `🏅 ${INSIGNIAS[codigo] || codigo}` })));
    const pendientes = await NQPendientes.contar().catch(() => 0);
    const caja = $("[data-final-pendientes]");
    caja.textContent = `⏳ Jugaste sin conexión: ${pendientes} respuesta${pendientes === 1 ? "" : "s"} se guardará${pendientes === 1 ? "" : "n"} cuando vuelva el internet. Los puntos oficiales y las insignias se cuentan en ese momento.`;
    caja.hidden = !pendientes;
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

  document.querySelectorAll("[data-volver]").forEach((b) => b.addEventListener("click", () => volverA("misiones")));
  $("[data-ir-preguntas]").addEventListener("click", () => {
    entrarAlJuego = true;
    ir(`jugar/${estado.mision.codigo}`);
  });

  // ---------- Rutas ----------
  // Cada pantalla tiene su ruta (#misiones, #mision/NQ-03, #jugar/NQ-03,
  // #resultado, #registro) para que el botón "atrás" del navegador regrese a
  // la pantalla anterior del juego y no a otra página del sitio.
  let turno = 0;              // evita que una carga lenta pinte una pantalla vieja
  let entrarAlJuego = false;  // #jugar solo se abre desde el botón "Ir a las preguntas"

  const rutaActual = () => decodeURIComponent(location.hash.slice(1));

  // Nueva entrada en el historial (avanzar)
  function ir(ruta) {
    if (ruta !== rutaActual()) history.pushState({ desde: rutaActual() }, "", `#${ruta}`);
    mostrarRuta();
  }
  // Cambia la entrada actual sin dejar rastro (registro, resultado, rutas inválidas)
  function reemplazar(ruta) {
    history.replaceState({ desde: history.state?.desde ?? null }, "", `#${ruta}`);
    mostrarRuta();
  }
  // Botones "volver": si la pantalla anterior es esa, equivale a "atrás"
  function volverA(ruta) {
    if (history.state?.desde === ruta) history.back(); else reemplazar(ruta);
  }

  async function mostrarRuta() {
    const miTurno = ++turno;
    const [pantalla, codigo] = rutaActual().split("/");
    if (!leer("nq_token")) {
      if (pantalla !== "registro") reemplazar("registro"); else mostrar("registro");
      return;
    }
    switch (pantalla) {
      case "misiones":
        return mostrarMisiones(miTurno);
      case "mision": {
        const lista = await abrirMision(codigo);
        if (miTurno !== turno) return;
        if (lista) mostrar("lectura"); else reemplazar("misiones");
        return;
      }
      case "jugar":
        // Al recargar o con "adelante" no se puede retomar una partida: a la lectura
        if (entrarAlJuego && estado.mision?.codigo === codigo) { entrarAlJuego = false; despegar(); }
        else reemplazar(`mision/${codigo}`);
        return;
      case "resultado":
        if (estado.resumen) mostrarFinal(); else reemplazar("misiones");
        return;
      default:
        // Sin ruta, o #registro con sesión iniciada
        reemplazar("misiones");
    }
  }
  window.addEventListener("popstate", mostrarRuta);

  // ---------- Sin conexión ----------
  // Si no hay internet, la respuesta se califica aquí con la "clave" que mandó el
  // servidor (sha256 de sal:id_correcta), se guarda en la bandeja (pendientes.js)
  // y se envía sola al volver la conexión. El servidor sigue siendo quien cuenta
  // los puntos oficiales: aquí solo se muestran mientras tanto.
  async function sha256(texto) {
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
    return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function jefeDerrotado(codigo) {
    try {
      return await NQ.llamar("jefe", { metodo: "POST", datos: { mision: codigo } });
    } catch (error) {
      if (!(error instanceof TypeError)) return { puntos_ganados: 0 };
      await NQPendientes.guardar({ jefe: codigo, token: leer("nq_token") });
      pedirSincronizacion();
      marcarSinRed(true);
      return { puntos_ganados: 0, sinConexion: true };
    }
  }

  async function responderJuego(opcionId) {
    try {
      const r = await NQ.responder(opcionId);
      marcarSinRed(false);
      return r;
    } catch (error) {
      const p = estado.preguntaDe?.get(opcionId);
      // Solo un fallo de red se califica aquí; un error del servidor se muestra
      if (!(error instanceof TypeError) || !p?.clave || !window.crypto?.subtle) throw error;
      const correcta = (await sha256(`${p.sal}:${opcionId}`)) === p.clave;
      await NQPendientes.guardar({ opcion_id: opcionId, token: leer("nq_token") });
      pedirSincronizacion();
      marcarSinRed(true);
      const primera = correcta && !estado.acertadasSinRed.has(p.id);
      if (correcta) estado.acertadasSinRed.add(p.id);
      return { correcta, puntos_ganados: primera ? Number(p.puntos) : 0, completada: false,
               insignias_nuevas: [], explicacion: correcta ? p.explicacion : null, sinConexion: true };
    }
  }

  function marcarSinRed(sinRed) { $("[data-sin-red]").hidden = !sinRed; }

  // Con Background Sync el service worker envía la bandeja aunque se cierre la
  // página; si el navegador no lo tiene, la envía la página al volver la conexión.
  async function pedirSincronizacion() {
    try {
      const reg = await navigator.serviceWorker?.ready;
      if (reg && "sync" in reg) { await reg.sync.register("nq-respuestas"); return; }
    } catch { /* sin Background Sync */ }
    if (navigator.onLine) sincronizarAqui();
  }
  async function sincronizarAqui() {
    const res = await NQPendientes.enviar(location.href).catch(() => null);
    if (res?.enviadas) avisarSincronizado(res);
  }
  function avisarSincronizado(res) {
    marcarSinRed(false);
    const n = res.enviadas === 1 ? "1 respuesta" : `${res.enviadas} respuestas`;
    aviso(`📡 Volvió el internet: se guardó lo que jugaste sin conexión (${n}, +${res.puntos} pts).`, "ok");
    res.insignias.forEach((codigo) =>
      AvisosJuego.local(`🏅 ¡Insignia nueva: ${INSIGNIAS[codigo] || codigo}!`, "La ganaste con tus respuestas sin conexión."));
    actualizarJugador();
  }
  navigator.serviceWorker?.addEventListener("message", (e) => {
    if (e.data?.tipo === "nq-sincronizado") avisarSincronizado(e.data);
  });
  window.addEventListener("online", pedirSincronizacion);
  window.addEventListener("offline", () => { if (rutaActual().startsWith("jugar/")) marcarSinRed(true); });

  // ---------- Inicio ----------
  async function iniciar() {
    NQPendientes.contar().then((n) => { if (n) pedirSincronizacion(); }).catch(() => {});
    if (!leer("nq_token")) { mostrarRuta(); return; }
    try {
      estado.progreso = await NQ.progreso();
    } catch (error) {
      if (/token/i.test(error.message)) {
        // El servidor rechazó el token: se pide registrarse de nuevo
        borrarSesion();
        await actualizarJugador();
        mostrarRuta();
        return;
      }
      // Sin conexión u otro fallo: se conserva la sesión y se intenta con lo guardado
      aviso(error instanceof TypeError
        ? "Estás sin conexión. Puedes jugar las misiones que ya se descargaron: tus respuestas se guardan y se envían solas cuando vuelva el internet."
        : mensajeDeError(error));
    }
    await actualizarJugador(false);
    mostrarRuta();
  }
  iniciar();
})();
