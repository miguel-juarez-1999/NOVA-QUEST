/* Viaje en el tiempo: línea de tiempo + historieta + retos + pasaporte
   de sellos + minijuego + diploma + avisos push */
(function () {
  "use strict";
  var $ = function (s) {
    return document.querySelector(s);
  };
  var ICONOS = {
    planeta: "🌍",
    luna: "🌙",
    lluvia: "🌧️",
    microbio: "🦠",
    oxigeno: "🫧",
    mar: "🐚",
    planta: "🌿",
    anfibio: "🦎",
    dinosaurio: "🦖",
    pangea: "🗺️",
    ave: "🐦",
    asteroide: "☄️",
    mamut: "🦣",
    humano: "🧑",
    hoy: "🌎",
  };
  var COLORES = [
    ["#7a1f0f", "#ff7a2f"],
    ["#0b3d5c", "#2bb3c0"],
    ["#14532d", "#6fcf6a"],
    ["#4a2c0a", "#d9a441"],
    ["#12348f", "#46b6ff"],
  ];
  // Escenas: fondo + elementos [emoji, x%, y%, tamaño, animación]
  // El tamaño está pensado para una viñeta de 320 px y se escala solo.
  var ESCENAS = {
    polvo: {
      bg: "linear-gradient(#0a0a1f,#2a1a3a)",
      it: [
        ["✨", 15, 25, 26, "late"],
        ["☁️", 60, 30, 46, "flota"],
        ["🪨", 80, 70, 34, "gira"],
        ["🪨", 30, 75, 28, "gira"],
        ["🧑‍🚀", 50, 65, 44, "flota"],
      ],
    },
    lava: {
      bg: "linear-gradient(#3a0a05,#e8501a)",
      it: [
        ["🌋", 30, 62, 56],
        ["🔥", 70, 70, 40, "late"],
        ["🔥", 55, 40, 28, "late"],
        ["☁️", 30, 22, 36, "sube"],
        ["🧑‍🚀", 80, 40, 40, "flota"],
      ],
    },
    choque: {
      bg: "linear-gradient(#050816,#1c2a6b)",
      it: [
        ["🌍", 30, 60, 70],
        ["🪐", 78, 35, 44, "choca"],
        ["💥", 55, 48, 40, "late"],
        ["🧑‍🚀", 82, 78, 36, "flota"],
      ],
    },
    luna: {
      bg: "linear-gradient(#050816,#1c2a6b)",
      it: [
        ["🌍", 30, 60, 66],
        ["🌙", 72, 35, 50, "flota"],
        ["⭐", 85, 15, 20, "late"],
        ["⭐", 12, 18, 18, "late"],
        ["🧑‍🚀", 78, 78, 36, "flota"],
      ],
    },
    lluvia: {
      bg: "linear-gradient(#262b3d,#5a6b86)",
      it: [
        ["☁️", 22, 18, 48, "flota"],
        ["☁️", 70, 14, 54, "flota"],
        ["💧", 18, 45, 20, "llueve"],
        ["💧", 40, 40, 18, "llueve"],
        ["💧", 62, 48, 20, "llueve"],
        ["💧", 82, 42, 18, "llueve"],
        ["🌋", 30, 78, 40],
        ["🧑‍🚀", 78, 76, 36],
        ["☂️", 72, 60, 30],
      ],
    },
    oceano: {
      bg: "linear-gradient(#7fd3ff,#0b4a86 65%)",
      it: [
        ["☀️", 84, 16, 30, "late"],
        ["🌊", 25, 75, 48, "nada"],
        ["🌊", 65, 80, 44, "nada"],
        ["🪨", 45, 62, 30],
        ["🧑‍🚀", 15, 40, 34, "flota"],
      ],
    },
    microbio: {
      bg: "linear-gradient(#0b3d5c,#2bb3c0)",
      it: [
        ["🦠", 30, 45, 46, "gira"],
        ["🦠", 62, 60, 36, "flota"],
        ["🫧", 78, 30, 30, "sube"],
        ["🫧", 15, 75, 24, "sube"],
        ["🧑‍🚀", 80, 78, 36, "flota"],
      ],
    },
    oxigeno: {
      bg: "linear-gradient(#5fd0c4,#0b5c5a)",
      it: [
        ["☀️", 82, 14, 32, "late"],
        ["🦠", 28, 70, 34, "flota"],
        ["🦠", 50, 76, 28, "flota"],
        ["🪨", 40, 86, 40],
        ["🫧", 30, 50, 22, "sube"],
        ["🫧", 50, 45, 18, "sube"],
        ["🫧", 62, 55, 24, "sube"],
        ["🧑‍🚀", 82, 70, 34, "flota"],
      ],
    },
    mar: {
      bg: "linear-gradient(#58c4ff,#0b4a86)",
      it: [
        ["🐚", 25, 72, 36],
        ["🪼", 60, 40, 44, "flota"],
        ["🐟", 78, 62, 34, "nada"],
        ["🌿", 45, 80, 32],
        ["🧑‍🚀", 88, 30, 34, "flota"],
      ],
    },
    plantas: {
      bg: "linear-gradient(#a8e6ff,#8b6b45 70%)",
      it: [
        ["☀️", 84, 14, 30, "late"],
        ["🪨", 25, 76, 44],
        ["🌱", 22, 62, 30, "late"],
        ["🌿", 50, 72, 36, "flota"],
        ["🍀", 68, 78, 28, "flota"],
        ["🧑‍🚀", 84, 66, 34],
      ],
    },
    anfibio: {
      bg: "linear-gradient(#a8e6ff 40%,#2a7fb8 60%)",
      it: [
        ["🌿", 15, 48, 34],
        ["🦎", 40, 54, 42, "brinca"],
        ["🐟", 66, 78, 32, "nada"],
        ["🌊", 30, 84, 36, "nada"],
        ["🧑‍🚀", 82, 40, 34, "flota"],
      ],
    },
    dinos: {
      bg: "linear-gradient(#9be3ff,#6fcf6a 70%)",
      it: [
        ["🦖", 35, 62, 68, "brinca"],
        ["🌴", 78, 58, 52],
        ["🦕", 62, 50, 40],
        ["☀️", 85, 15, 30, "late"],
        ["🧑‍🚀", 12, 78, 34],
      ],
    },
    pangea: {
      bg: "linear-gradient(#0b4a86,#2a7fb8)",
      it: [
        ["🗺️", 50, 50, 70, "flota"],
        ["🧩", 22, 30, 30, "separa"],
        ["🧩", 78, 72, 30, "separa"],
        ["🌊", 20, 80, 30, "nada"],
        ["🧑‍🚀", 84, 22, 32, "flota"],
      ],
    },
    aves: {
      bg: "linear-gradient(#bdeaff,#7fcf6a 75%)",
      it: [
        ["🐦", 30, 28, 34, "vuela"],
        ["🪶", 62, 40, 26, "flota"],
        ["🦖", 30, 70, 44],
        ["🌴", 76, 62, 48],
        ["🧑‍🚀", 88, 82, 30],
      ],
    },
    asteroide: {
      bg: "linear-gradient(#ffb36b,#c0341d)",
      it: [
        ["☄️", 60, 28, 64, "cae"],
        ["🦖", 22, 70, 48],
        ["🔥", 75, 74, 36, "late"],
        ["🧑‍🚀", 88, 80, 34],
      ],
    },
    hielo: {
      bg: "linear-gradient(#cdeeff,#ffffff 80%)",
      it: [
        ["🏔️", 76, 50, 56],
        ["🦣", 34, 66, 60, "brinca"],
        ["❄️", 20, 20, 18, "llueve"],
        ["❄️", 50, 16, 16, "llueve"],
        ["❄️", 70, 22, 18, "llueve"],
        ["🧑‍🚀", 86, 82, 32],
      ],
    },
    humano: {
      bg: "linear-gradient(#9be3ff,#f3e5b0 75%)",
      it: [
        ["🧑", 30, 62, 52],
        ["🔥", 52, 72, 34, "late"],
        ["🏠", 76, 58, 50],
        ["🌳", 12, 62, 40],
        ["🧑‍🚀", 90, 80, 32],
      ],
    },
    hoy: {
      bg: "linear-gradient(#9be3ff,#7fcf6a 75%)",
      it: [
        ["🌎", 50, 36, 62, "gira"],
        ["🌳", 16, 70, 42],
        ["🐝", 34, 60, 22, "vuela"],
        ["💧", 64, 76, 24, "late"],
        ["🏙️", 82, 68, 40],
        ["🧑‍🚀", 40, 80, 34, "brinca"],
      ],
    },
  };
  var NARRADOR = "🧑‍🚀 Capi Nova";
  var CLAVE = "nq_tiempo";
  var RONDAS = 5;

  var etapas = [],
    eventos = [],
    idx = 0,
    mostradas = 0,
    estado = leerEstado();

  // ----- utilidades -----
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function aviso(t) {
    var a = $("[data-aviso]");
    a.textContent = t;
    a.hidden = !t;
  }
  function leerEstado() {
    var e = null;
    try {
      e = JSON.parse(localStorage.getItem(CLAVE));
    } catch (err) {}
    e = e && typeof e === "object" ? e : {};
    e.vistas = e.vistas || {};
    e.retos = e.retos || {};
    e.sellos = e.sellos || {};
    return e;
  }
  function guardarEstado() {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(estado));
    } catch (err) {}
  }
  function tieneToken() {
    try {
      return !!localStorage.getItem("nq_token");
    } catch (err) {
      return false;
    }
  }
  function revolver(lista) {
    var a = lista.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)),
        t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }
  function sinMovimiento() {
    return (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }
  function hace(m) {
    m = parseFloat(m);
    if (m <= 0) return "¡Hoy!";
    if (m >= 1)
      return (
        "Hace " +
        m.toLocaleString("es-MX", { maximumFractionDigits: 1 }) +
        " millones de años"
      );
    return "Hace " + Math.round(m * 1e6).toLocaleString("es-MX") + " años";
  }
  function hora(m) {
    if (parseFloat(m) <= 0) return "24:00:00";
    var seg = Math.max(
      0,
      Math.min(86399, Math.round(((4600 - parseFloat(m)) / 4600) * 86400)),
    );
    var h = Math.floor(seg / 3600),
      mi = Math.floor((seg % 3600) / 60),
      s = seg % 60;
    return [h, mi, s]
      .map(function (n) {
        return String(n).padStart(2, "0");
      })
      .join(":");
  }
  function posicionReloj(m) {
    return Math.max(0, Math.min(100, ((4600 - m) / 4600) * 100));
  }

  // ----- avisos dentro de la página -----
  function toast(texto) {
    var caja = $("[data-toasts]");
    // Evita repetir el mismo aviso (por ejemplo, al arrastrar la máquina)
    var repetido = Array.prototype.some.call(caja.children, function (t) {
      return t.textContent === texto;
    });
    if (repetido) return;
    var t = el("div", "toast", texto);
    caja.appendChild(t);
    setTimeout(function () {
      t.classList.add("sale");
      setTimeout(function () {
        t.remove();
      }, 400);
    }, 4200);
  }
  function confeti() {
    if (sinMovimiento()) return;
    var capa = el("div", "confeti");
    capa.setAttribute("aria-hidden", "true");
    var piezas = ["⭐", "🎉", "✨", "🌟", "🪐"];
    for (var i = 0; i < 26; i++) {
      var p = el("span", null, piezas[i % piezas.length]);
      p.style.left = Math.random() * 100 + "%";
      p.style.animationDelay = Math.random() * 0.6 + "s";
      p.style.fontSize = 16 + Math.random() * 18 + "px";
      capa.appendChild(p);
    }
    document.body.appendChild(capa);
    setTimeout(function () {
      capa.remove();
    }, 3000);
  }
  // Notificación del sistema (solo si el niño ya dio permiso)
  function notificar(titulo, cuerpo) {
    if (
      !("Notification" in window) ||
      Notification.permission !== "granted" ||
      !("serviceWorker" in navigator)
    )
      return;
    navigator.serviceWorker.ready
      .then(function (reg) {
        return reg.showNotification(titulo, {
          body: cuerpo,
          icon: "assets/icons/icon-192.png",
          badge: "assets/icons/icon-192.png",
          tag: "novaquest-logro",
          lang: "es",
          data: { url: "linea-tiempo.html" },
        });
      })
      .catch(function () {});
  }

  // ----- leer en voz alta -----
  var hayVoz = "speechSynthesis" in window,
    botonHablando = null;
  function vozEspanol() {
    var voces = window.speechSynthesis.getVoices();
    return (
      voces.filter(function (v) {
        return /^es[-_]MX/i.test(v.lang);
      })[0] ||
      voces.filter(function (v) {
        return /^es/i.test(v.lang);
      })[0] ||
      null
    );
  }
  function callar() {
    if (!hayVoz) return;
    window.speechSynthesis.cancel();
    if (botonHablando) botonHablando.setAttribute("aria-pressed", "false");
    botonHablando = null;
  }
  function leer(texto, boton) {
    if (!hayVoz) return;
    var eraEste = boton && boton === botonHablando;
    callar();
    if (eraEste) return; // segundo toque: detener
    var u = new SpeechSynthesisUtterance(texto);
    u.lang = "es-MX";
    u.rate = 0.95;
    u.pitch = 1.1;
    var v = vozEspanol();
    if (v) u.voice = v;
    if (boton) {
      botonHablando = boton;
      boton.setAttribute("aria-pressed", "true");
      u.onend = u.onerror = function () {
        if (botonHablando === boton) callar();
      };
    }
    window.speechSynthesis.speak(u);
  }
  function lecturaAutomatica() {
    var c = $("[data-auto-voz]");
    return hayVoz && c && c.checked;
  }
  function botonVoz(texto) {
    var b = el("button", "btn-voz mini", "🔊");
    b.type = "button";
    b.setAttribute("aria-pressed", "false");
    b.setAttribute("aria-label", "Escuchar este diálogo");
    b.addEventListener("click", function () {
      leer(texto, b);
    });
    return b;
  }

  // ----- carga de datos -----
  function cargar() {
    return NQ.lineaTiempo().then(function (d) {
      etapas = Array.isArray(d) ? d : d.etapas || [];
      eventos = [];
      etapas.forEach(function (et, i) {
        (et.eventos || []).forEach(function (ev) {
          ev._et = et;
          ev._ei = i;
          eventos.push(ev);
        });
      });
      eventos.sort(function (a, b) {
        return b.hace_millones - a.hace_millones;
      });
    });
  }

  // Si el niño ya tiene cadete, recupera los retos resueltos en el servidor
  // (por ejemplo, si jugó en otra computadora).
  function sincronizar() {
    if (!tieneToken()) return Promise.resolve();
    return NQ.progreso()
      .then(function (p) {
        if (p.usuario && !estado.nombre) estado.nombre = p.usuario;
        (p.etapas || []).forEach(function (pe) {
          if (pe.estado !== "completada") return;
          etapas.forEach(function (et) {
            if (et.nombre !== pe.nombre) return;
            (et.reto || []).forEach(function (q) {
              if (!estado.retos[q.id]) estado.retos[q.id] = { o: null };
            });
          });
        });
        guardarEstado();
      })
      .catch(function () {});
  }

  // ----- avance: qué puede ver el niño -----
  function historietaVista(ev) {
    return (estado.vistas[ev.id] || 0) >= (ev.vinetas || []).length;
  }
  function historietasEtapa(et) {
    return (et.eventos || []).every(historietaVista);
  }
  function retosResueltos(et) {
    return (et.reto || []).every(function (q) {
      return !!estado.retos[q.id];
    });
  }
  function etapaCompleta(et) {
    return historietasEtapa(et) && retosResueltos(et);
  }
  function primeroDeEtapa(i) {
    return eventos.findIndex(function (e) {
      return e._ei === i;
    });
  }
  function ultimoDeEtapa(k) {
    return k === eventos.length - 1 || eventos[k + 1]._ei !== eventos[k]._ei;
  }
  // Último momento al que se puede llegar: cada historieta se lee completa
  // y el reto de una etapa se resuelve antes de pasar a la siguiente.
  function tope() {
    for (var k = 0; k < eventos.length - 1; k++) {
      if (!historietaVista(eventos[k])) return k;
      if (ultimoDeEtapa(k) && !retosResueltos(eventos[k]._et)) return k;
    }
    return eventos.length - 1;
  }
  function motivoBloqueo() {
    var ev = eventos[tope()];
    return historietaVista(ev)
      ? "🔒 Primero resuelve el reto de la etapa " + ev._et.nombre + "."
      : "🔒 Primero termina la historieta «" + ev.titulo + "».";
  }
  // Lleva al reto (espera a que termine la lectura en voz alta)
  function irAlReto(inmediato) {
    var mover = function () {
      if (hayVoz && window.speechSynthesis.speaking) return setTimeout(mover, 500);
      var r = $("[data-reto]");
      if (r.hidden) return;
      r.scrollIntoView({ behavior: sinMovimiento() ? "auto" : "smooth", block: "start" });
      var b = r.querySelector(".reto-opcion:not(:disabled)");
      if (b) b.focus({ preventScroll: true });
    };
    setTimeout(mover, inmediato ? 0 : 1800);
  }
  function pintarBloqueos() {
    var max = tope();
    document.querySelectorAll("[data-marcas] button").forEach(function (b, k) {
      var no = k > max;
      b.classList.toggle("bloqueado", no);
      b.textContent = no ? "🔒" : ICONOS[eventos[k].icono] || "⭐";
      b.title = no ? "Bloqueado" : eventos[k].titulo;
      b.setAttribute("aria-label", no ? "Momento " + (k + 1) + " (bloqueado)" : eventos[k].titulo);
    });
    document.querySelectorAll(".chip").forEach(function (c) {
      c.classList.toggle("bloqueado", primeroDeEtapa(+c.dataset.i) > max);
    });
    document.querySelectorAll(".sello").forEach(function (s, i) {
      s.classList.toggle("bloqueado", primeroDeEtapa(i) > max);
    });
    var d = $("[data-despues]");
    var bloq = idx >= max && idx < eventos.length - 1;
    d.classList.toggle("bloqueado", bloq);
    d.textContent = bloq ? "🔒 Más reciente →" : "Más reciente →";
  }

  // ----- pasaporte de sellos -----
  function revisarSello(et) {
    if (estado.sellos[et.id] || !etapaCompleta(et)) return;
    estado.sellos[et.id] = true;
    guardarEstado();
    var n = contarSellos();
    toast("🏅 ¡Ganaste el sello " + et.nombre + "!");
    notificar(
      "🏅 ¡Sello " + et.nombre + " conseguido!",
      n < etapas.length
        ? "Llevas " + n + " de " + etapas.length + " sellos en tu pasaporte del tiempo."
        : "¡Completaste tu pasaporte! Ya puedes imprimir tu diploma.",
    );
    confeti();
    pintarSellos();
    if (n === etapas.length) mostrarDiploma(true);
  }
  function contarSellos() {
    return etapas.filter(function (et) {
      return estado.sellos[et.id];
    }).length;
  }
  function iconoEtapa(et) {
    var ev = (et.eventos || [])[0];
    return (ev && ICONOS[ev.icono]) || "⭐";
  }
  function irAEtapa(i) {
    var p = primeroDeEtapa(i);
    if (p >= 0) ir(p);
  }
  function pintarSellos() {
    var lista = $("[data-sellos]");
    lista.innerHTML = "";
    etapas.forEach(function (et, i) {
      var ganado = !!estado.sellos[et.id];
      var li = el("li");
      var b = el("button", "sello" + (ganado ? " ganado" : ""));
      b.type = "button";
      b.setAttribute(
        "aria-label",
        "Etapa " + (i + 1) + ", " + et.nombre + (ganado ? ": sello ganado" : ": sin sello"),
      );
      b.appendChild(el("span", "sello-icono", ganado ? iconoEtapa(et) : String(i + 1)));
      b.appendChild(el("span", "sello-nombre", et.nombre));
      b.addEventListener("click", function () {
        irAEtapa(i);
        $("[data-evento]").scrollIntoView({ behavior: sinMovimiento() ? "auto" : "smooth" });
      });
      li.appendChild(b);
      lista.appendChild(li);
    });
    var n = contarSellos();
    $("[data-sellos-barra]").style.width = (etapas.length ? (n / etapas.length) * 100 : 0) + "%";
    $("[data-sellos-texto]").textContent =
      n === 0
        ? "Completa cada etapa para ganar su sello."
        : n < etapas.length
          ? "¡Llevas " + n + " de " + etapas.length + " sellos! Sigue viajando."
          : "¡Pasaporte completo! Eres Viajero del Tiempo. 🏆";
    document.querySelectorAll(".chip").forEach(function (c) {
      c.classList.toggle("ganado", !!estado.sellos[etapas[+c.dataset.i].id]);
    });
    pintarBloqueos();
  }

  // ----- controles -----
  function dibujarControles() {
    var chips = $("[data-chips]");
    chips.innerHTML = "";
    etapas.forEach(function (et, i) {
      var b = el("button", "chip", et.nombre);
      b.type = "button";
      b.dataset.i = i;
      b.addEventListener("click", function () {
        irAEtapa(i);
      });
      chips.appendChild(b);
    });
    var s = $("[data-slider]");
    s.max = Math.max(0, eventos.length - 1);
    var m = $("[data-marcas]");
    m.innerHTML = "";
    var barra = $("[data-reloj-barra]");
    barra.querySelectorAll("b").forEach(function (b) {
      b.remove();
    });
    eventos.forEach(function (ev, i) {
      var li = el("li");
      var b = el("button", null, ICONOS[ev.icono] || "⭐");
      b.type = "button";
      b.title = ev.titulo;
      b.setAttribute("aria-label", ev.titulo);
      b.addEventListener("click", function () {
        ir(i);
      });
      li.appendChild(b);
      m.appendChild(li);
      // puntito de cada momento en el reloj de 24 horas
      var punto = el("b");
      punto.style.left = posicionReloj(ev.hace_millones) + "%";
      punto.title = ev.titulo + " · " + hora(ev.hace_millones);
      barra.appendChild(punto);
    });
  }

  // ----- historieta -----
  function panel(v, n, nueva) {
    var esc = ESCENAS[v.escena] || ESCENAS.polvo;
    var f = el("figure", "panel" + (nueva ? " nueva" : ""));
    f.appendChild(el("span", "panel-num", String(n)));
    var sc = el("div", "panel-escena");
    sc.style.background = esc.bg;
    sc.setAttribute("role", "img");
    sc.setAttribute("aria-label", "Viñeta " + n + " de la historieta");
    esc.it.forEach(function (it, k) {
      var s = el("span", "item" + (it[4] ? " " + it[4] : ""), it[0]);
      s.style.left = it[1] + "%";
      s.style.top = it[2] + "%";
      s.style.fontSize = (it[3] / 3.2).toFixed(1) + "cqw";
      s.style.setProperty("--d", (k * 0.37).toFixed(2) + "s");
      sc.appendChild(s);
    });
    f.appendChild(sc);
    var globo = el("div", "globo");
    var cab = el("p", "globo-quien", NARRADOR);
    if (hayVoz) cab.appendChild(botonVoz(v.dialogo));
    globo.appendChild(cab);
    globo.appendChild(el("p", "globo-texto", v.dialogo));
    f.appendChild(globo);
    return f;
  }
  function historieta(reset) {
    var ev = eventos[idx],
      vs = ev.vinetas || [];
    var sec = $("[data-historieta]");
    sec.hidden = vs.length === 0;
    var comic = $("[data-comic]");
    if (reset) {
      comic.innerHTML = "";
      mostradas = 0;
      // Si ya la había leído, se muestran las viñetas que ya vio
      var yaVistas = Math.min(vs.length, estado.vistas[ev.id] || 0);
      for (var k = 0; k < Math.max(1, yaVistas); k++) {
        if (vs[k]) comic.appendChild(panel(vs[k], k + 1, k === 0));
      }
      mostradas = Math.min(vs.length, Math.max(1, yaVistas));
    }
    if (!vs.length) {
      revisarSello(ev._et);
      return;
    }
    $("[data-vineta-cuenta]").textContent = "VIÑETA " + mostradas + " DE " + vs.length;
    marcarVistas(ev, mostradas);
    pintarBotonSiguiente();
  }
  // El botón de la historieta cambia según lo que sigue: otra viñeta, el
  // reto de la etapa, el siguiente momento o la siguiente etapa.
  function pintarBotonSiguiente() {
    var ev = eventos[idx],
      btn = $("[data-siguiente]");
    var fin = mostradas >= (ev.vinetas || []).length,
      ultimo = idx === eventos.length - 1,
      cierra = ultimoDeEtapa(idx),
      faltaReto = cierra && !retosResueltos(ev._et);
    btn.disabled = fin && ultimo && !faltaReto;
    btn.textContent = !fin
      ? "Siguiente viñeta →"
      : faltaReto
        ? "📝 ¡Ir al reto de la etapa!"
        : ultimo
          ? "🎉 ¡Llegaste al final del viaje!"
          : cierra
            ? "🚀 Viajar a la siguiente etapa →"
            : "🚀 Viajar al siguiente momento →";
  }
  function siguiente() {
    var ev = eventos[idx],
      vs = ev.vinetas || [];
    if (mostradas >= vs.length) {
      if (ultimoDeEtapa(idx) && !retosResueltos(ev._et)) {
        irAlReto(true);
      } else if (idx < eventos.length - 1) {
        ir(idx + 1);
        $("[data-evento]").scrollIntoView({ behavior: sinMovimiento() ? "auto" : "smooth" });
      }
      return;
    }
    var nuevo = panel(vs[mostradas], mostradas + 1, true);
    $("[data-comic]").appendChild(nuevo);
    nuevo.scrollIntoView({ behavior: sinMovimiento() ? "auto" : "smooth", block: "nearest" });
    if (lecturaAutomatica()) leer(vs[mostradas].dialogo, nuevo.querySelector(".btn-voz"));
    mostradas++;
    historieta(false);
    // Se acabaron las historietas de la etapa: directo al reto
    if (mostradas >= vs.length && ultimoDeEtapa(idx) && !retosResueltos(ev._et)) {
      toast("📝 ¡Terminaste las historietas de " + ev._et.nombre + "! Ahora resuelve el reto.");
      irAlReto(false);
    }
  }
  function marcarVistas(ev, n) {
    var antes = estado.vistas[ev.id] || 0;
    if (n <= antes) return;
    var etapaAntes = historietasEtapa(ev._et);
    estado.vistas[ev.id] = n;
    guardarEstado();
    // Se desbloquea el reto al terminar todas las historietas de la etapa
    if (!etapaAntes && historietasEtapa(ev._et)) reto(ev._et);
    pintarBloqueos();
    revisarSello(ev._et);
    if (!tieneToken()) return;
    // El servidor guarda el total de viñetas vistas en la etapa
    var total = (ev._et.eventos || []).reduce(function (s, e) {
      return s + (estado.vistas[e.id] || 0);
    }, 0);
    NQ.llamar("etapa_progreso", {
      metodo: "POST",
      datos: { etapa_id: ev._et.id, vinetas_vistas: total },
    }).catch(function () {});
  }

  // ----- navegar entre momentos -----
  function ir(i) {
    if (!eventos.length) return;
    callar();
    var max = tope(),
      alReto = false;
    if (i > max) {
      toast(motivoBloqueo());
      alReto = historietaVista(eventos[max]);
      i = max;
    }
    idx = Math.max(0, Math.min(eventos.length - 1, i));
    estado.ultimo = idx;
    guardarEstado();
    var ev = eventos[idx],
      et = ev._et,
      col = COLORES[ev._ei % COLORES.length];
    $("[data-slider]").value = idx;
    $("[data-slider]").setAttribute("aria-valuetext", ev.titulo + ", " + hace(ev.hace_millones));
    document.querySelectorAll(".chip").forEach(function (c) {
      c.setAttribute("aria-pressed", String(+c.dataset.i === ev._ei));
    });
    document.querySelectorAll("[data-marcas] button").forEach(function (b, k) {
      if (k === idx) b.setAttribute("aria-current", "true");
      else b.removeAttribute("aria-current");
      b.classList.toggle("visto", (estado.vistas[eventos[k].id] || 0) >= (eventos[k].vinetas || []).length);
    });
    var esc = $("[data-escena]");
    esc.style.setProperty("--c1", col[0]);
    esc.style.setProperty("--c2", col[1]);
    var ic = $("[data-icono]");
    ic.textContent = ICONOS[ev.icono] || "⭐";
    ic.style.animation = "none";
    void ic.offsetWidth;
    ic.style.animation = "";
    $("[data-num]").textContent = "MOMENTO " + (idx + 1) + " DE " + eventos.length;
    $("[data-hace]").textContent = hace(ev.hace_millones);
    $("[data-etapa]").textContent = "ETAPA " + (ev._ei + 1) + " · " + et.nombre.toUpperCase();
    $("[data-etapa-desc]").textContent = et.descripcion || "";
    $("[data-titulo]").textContent = ev.titulo;
    $("[data-texto]").textContent = ev.texto;
    $("[data-antes]").disabled = idx === 0;
    $("[data-despues]").disabled = idx === eventos.length - 1;
    $("[data-reloj-marca]").style.left = posicionReloj(ev.hace_millones) + "%";
    var rt = $("[data-reloj-texto]");
    rt.textContent = "";
    rt.appendChild(
      document.createTextNode(
        parseFloat(ev.hace_millones) <= 0
          ? "Si toda la historia de la Tierra fuera un día, hoy sería justo la "
          : "Si toda la historia de la Tierra fuera un día, esto pasó a las ",
      ),
    );
    rt.appendChild(el("b", null, parseFloat(ev.hace_millones) <= 0 ? "medianoche (24:00)" : hora(ev.hace_millones)));
    rt.appendChild(document.createTextNode("."));
    try {
      history.replaceState(null, "", "#momento-" + ev.id);
    } catch (err) {}
    historieta(true);
    reto(et);
    pintarBloqueos();
    if (alReto) irAlReto(true);
    else if (lecturaAutomatica()) leer(ev.titulo + ". " + ev.texto, $("[data-leer-evento]"));
  }
  function irDesdeHash() {
    var m = /^#momento-(\d+)$/.exec(location.hash);
    if (!m) return false;
    var p = eventos.findIndex(function (e) {
      return String(e.id) === m[1];
    });
    if (p < 0) return false;
    ir(p);
    $("[data-evento]").scrollIntoView();
    return true;
  }

  // ----- retos -----
  function datoCurioso(texto) {
    var d = el("p", "reto-dato");
    d.appendChild(el("b", null, "💡 ¿Sabías que...? "));
    d.appendChild(document.createTextNode(texto));
    return d;
  }
  function reto(et) {
    var sec = $("[data-reto]"),
      lista = $("[data-reto-lista]");
    lista.innerHTML = "";
    var preg = et.reto || [];
    sec.hidden = preg.length === 0;
    if (!preg.length) return;
    $("[data-reto-etapa]").textContent = "RETO · " + et.nombre.toUpperCase();
    if (!historietasEtapa(et)) {
      var faltan = (et.eventos || []).filter(function (ev) {
        return !historietaVista(ev);
      }).length;
      lista.appendChild(
        el(
          "p",
          "reto-bloqueado",
          "🔒 Termina " +
            (faltan === 1 ? "la historieta que falta" : "las " + faltan + " historietas que faltan") +
            " de esta etapa para desbloquear el reto.",
        ),
      );
      return;
    }
    preg.forEach(function (p, n) {
      var hecho = estado.retos[p.id];
      var box = el("div", "reto-pregunta" + (hecho ? " resuelta" : ""));
      var h = el("h3", null, (n + 1) + ". " + p.texto);
      box.appendChild(h);
      var ops = el("div", "reto-opciones");
      var msg = el("p", "reto-msg");
      msg.setAttribute("role", "status");
      revolver(p.opciones || []).forEach(function (o) {
        var b = el("button", "reto-opcion", o.texto);
        b.type = "button";
        if (hecho) {
          b.disabled = true;
          if (hecho.o === o.id) b.classList.add("ok");
        }
        b.addEventListener("click", function () {
          responder(et, p, o, b, ops, msg, box);
        });
        ops.appendChild(b);
      });
      box.appendChild(ops);
      box.appendChild(msg);
      if (hecho) {
        msg.textContent = "✅ ¡Ya resolviste esta pregunta!";
        if (hecho.x) box.appendChild(datoCurioso(hecho.x));
      }
      lista.appendChild(box);
    });
    if (retosResueltos(et)) lista.appendChild(avanceEtapa(et));
  }
  // Aparece cuando todas las preguntas de la etapa están bien contestadas
  function avanceEtapa(et) {
    var caja = el("div", "reto-avance");
    var i = etapas.indexOf(et);
    caja.appendChild(el("p", null, "🎉 ¡Etapa " + et.nombre + " completa!"));
    if (i < etapas.length - 1) {
      var b = el("button", "btn-tiempo acid", "🚀 Viajar a la etapa " + etapas[i + 1].nombre + " →");
      b.type = "button";
      b.addEventListener("click", function () {
        irAEtapa(i + 1);
        $("[data-evento]").scrollIntoView({ behavior: sinMovimiento() ? "auto" : "smooth" });
      });
      caja.appendChild(b);
    }
    return caja;
  }
  function responder(et, p, o, b, ops, msg, box) {
    if (!tieneToken()) {
      msg.textContent = "Para responder, primero crea tu cadete en ";
      var a = el("a", null, "Jugar");
      a.href = "juego.html";
      msg.appendChild(a);
      msg.appendChild(document.createTextNode(". ¡Toma un minuto!"));
      return;
    }
    var botones = ops.querySelectorAll("button");
    botones.forEach(function (x) {
      x.disabled = true;
    });
    msg.textContent = "Revisando...";
    NQ.responder(o.id)
      .then(function (r) {
        if (r.correcta) {
          b.classList.add("ok");
          box.classList.add("resuelta");
          msg.textContent =
            "🎉 ¡Correcto! " + (r.puntos_ganados ? "+" + r.puntos_ganados + " puntos" : "");
          if (r.explicacion) {
            box.appendChild(datoCurioso(r.explicacion));
            if (lecturaAutomatica()) leer("¡Correcto! " + r.explicacion);
          }
          estado.retos[p.id] = { o: o.id, x: r.explicacion || "" };
          guardarEstado();
          if ((r.insignias_nuevas || []).indexOf("viajero_tiempo") >= 0) {
            toast("🏆 ¡Nueva insignia: Viajero del tiempo!");
          }
          revisarSello(et);
          // Todas bien: se desbloquea la siguiente etapa
          if (retosResueltos(et)) {
            $("[data-reto-lista]").appendChild(avanceEtapa(et));
            pintarBloqueos();
            if (eventos[idx]._et === et) pintarBotonSiguiente();
          }
        } else {
          b.classList.add("mal");
          msg.textContent = "¡Casi! Vuelve a leer la historieta y prueba otra opción. 💪";
          botones.forEach(function (x) {
            if (!x.classList.contains("mal")) x.disabled = false;
          });
        }
      })
      .catch(function (e) {
        msg.textContent =
          e instanceof TypeError
            ? "Sin conexión. Inténtalo cuando vuelva el internet."
            : e.message;
        botones.forEach(function (x) {
          if (!x.classList.contains("mal")) x.disabled = false;
        });
      });
  }

  // ----- minijuego: ¿qué pasó primero? -----
  var juego = { ronda: 0, aciertos: 0 };
  function nuevaPartida() {
    juego.ronda = 0;
    juego.aciertos = 0;
    nuevaRonda();
  }
  function nuevaRonda() {
    juego.ronda++;
    var par = revolver(eventos).slice(0, 2);
    if (par.length < 2 || par[0].hace_millones === par[1].hace_millones) {
      par = [eventos[0], eventos[eventos.length - 1]];
    }
    $("[data-orden-ronda]").textContent =
      "Ronda " + juego.ronda + " de " + RONDAS + " · Toca el que pasó primero (el más antiguo)";
    $("[data-orden-msg]").textContent = "";
    $("[data-orden-otra]").hidden = true;
    var caja = $("[data-orden-opciones]");
    caja.innerHTML = "";
    var antiguo = par[0].hace_millones > par[1].hace_millones ? par[0] : par[1];
    par.forEach(function (ev) {
      var b = el("button", "orden-carta");
      b.type = "button";
      b.appendChild(el("span", "orden-icono", ICONOS[ev.icono] || "⭐"));
      b.appendChild(el("span", "orden-titulo", ev.titulo));
      b.addEventListener("click", function () {
        var bien = ev === antiguo;
        if (bien) juego.aciertos++;
        caja.querySelectorAll("button").forEach(function (x, k) {
          x.disabled = true;
          x.appendChild(el("small", "orden-hace", hace(par[k].hace_millones)));
        });
        b.classList.add(bien ? "ok" : "mal");
        var otro = par[0] === ev ? par[1] : par[0];
        $("[data-orden-msg]").textContent = bien
          ? "¡Muy bien! «" + ev.titulo + "» pasó antes que «" + otro.titulo + "»."
          : "¡Uy! Primero pasó «" + antiguo.titulo + "».";
        terminarRonda();
      });
      caja.appendChild(b);
    });
  }
  function terminarRonda() {
    var otra = $("[data-orden-otra]");
    otra.hidden = false;
    if (juego.ronda < RONDAS) {
      otra.textContent = "Siguiente ronda →";
      return;
    }
    var estrellas = new Array(juego.aciertos + 1).join("⭐");
    $("[data-orden-msg]").textContent +=
      " Resultado: " + juego.aciertos + " de " + RONDAS + " " + estrellas;
    otra.textContent = "🔁 Jugar otra vez";
    if (juego.aciertos > (estado.mejorOrden || 0)) {
      estado.mejorOrden = juego.aciertos;
      guardarEstado();
    }
    if (juego.aciertos === RONDAS) {
      toast("🌟 ¡Perfecto! Conoces muy bien la historia de la Tierra.");
      confeti();
    }
  }

  // ----- diploma -----
  function mostrarDiploma(desplazar) {
    var d = $("[data-diploma]");
    d.hidden = false;
    var nombre = $("[data-diploma-nombre]");
    if (!nombre.value) nombre.value = estado.nombre || "";
    var sellos = $("[data-diploma-sellos]");
    sellos.innerHTML = "";
    etapas.forEach(function (et) {
      var li = el("li");
      li.appendChild(el("span", null, iconoEtapa(et)));
      li.appendChild(el("small", null, et.nombre));
      sellos.appendChild(li);
    });
    $("[data-diploma-fecha]").textContent = new Date().toLocaleDateString("es-MX", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    if (desplazar) d.scrollIntoView({ behavior: sinMovimiento() ? "auto" : "smooth" });
  }

  // ----- avisos push -----
  var pushSoportado =
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  function base64ABytes(b64) {
    var relleno = "=".repeat((4 - (b64.length % 4)) % 4);
    var bin = atob((b64 + relleno).replace(/-/g, "+").replace(/_/g, "/"));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  function registroListo() {
    return Promise.race([
      navigator.serviceWorker.ready,
      new Promise(function (_, no) {
        setTimeout(function () {
          no(new Error("El modo sin internet no está listo. Recarga la página."));
        }, 8000);
      }),
    ]);
  }
  function pintarAvisos(activo, texto) {
    var est = $("[data-avisos-estado]");
    $("[data-avisos-activar]").hidden = activo || !pushSoportado;
    $("[data-avisos-probar]").hidden = !activo;
    $("[data-avisos-desactivar]").hidden = !activo;
    $("[data-campana-texto]").textContent = activo ? "Avisos activos" : "Avisos";
    $("[data-campana]").classList.toggle("activa", !!activo);
    if (texto != null) est.textContent = texto;
    else if (!pushSoportado) est.textContent = "😕 Este navegador no permite avisos.";
    else if (Notification.permission === "denied")
      est.textContent =
        "🔕 Los avisos están bloqueados. Un adulto puede permitirlos en el candado 🔒 junto a la dirección de la página.";
    else est.textContent = activo ? "✅ Los avisos están activados." : "";
  }
  function revisarAvisos() {
    if (!pushSoportado) return pintarAvisos(false);
    registroListo()
      .then(function (reg) {
        return reg.pushManager.getSubscription();
      })
      .then(function (sub) {
        pintarAvisos(!!sub && Notification.permission === "granted");
      })
      .catch(function () {
        pintarAvisos(false);
      });
  }
  function activarAvisos() {
    var boton = $("[data-avisos-activar]");
    boton.disabled = true;
    pintarAvisos(false, "Preparando...");
    var reg;
    Notification.requestPermission()
      .then(function (permiso) {
        if (permiso !== "granted") throw new Error("permiso");
        return registroListo();
      })
      .then(function (r) {
        reg = r;
        return Promise.all([NQ.llamar("push_clave"), reg.pushManager.getSubscription()]);
      })
      .then(function (res) {
        // Si había una suscripción vieja (con otra clave) se reemplaza
        var vieja = res[1] ? res[1].unsubscribe() : Promise.resolve();
        return vieja.then(function () {
          return reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: base64ABytes(res[0].clave),
          });
        });
      })
      .then(function (sub) {
        return NQ.llamar("push_suscribir", { metodo: "POST", datos: sub.toJSON() });
      })
      .then(function () {
        pintarAvisos(true, "✅ ¡Listo! Te avisaremos con datos curiosos de la Tierra.");
        notificar("🚀 ¡Avisos activados, cadete!", "Así se verán los datos curiosos de tu viaje en el tiempo.");
      })
      .catch(function (e) {
        pintarAvisos(
          false,
          e.message === "permiso"
            ? Notification.permission === "denied"
              ? null
              : "Está bien, puedes activarlos cuando quieras."
            : "😕 No se pudieron activar los avisos: " + e.message,
        );
      })
      .then(function () {
        boton.disabled = false;
      });
  }
  function probarAvisos() {
    var boton = $("[data-avisos-probar]");
    boton.disabled = true;
    registroListo()
      .then(function (reg) {
        return reg.pushManager.getSubscription();
      })
      .then(function (sub) {
        if (!sub) throw new Error("Primero activa los avisos.");
        return NQ.llamar("push_prueba", { metodo: "POST", datos: { endpoint: sub.endpoint } });
      })
      .then(function () {
        pintarAvisos(true, "📨 ¡Enviado! Tu dato curioso llegará en unos segundos.");
      })
      .catch(function (e) {
        pintarAvisos(!/venció|activa/.test(e.message), "😕 " + e.message);
      })
      .then(function () {
        setTimeout(function () {
          boton.disabled = false;
        }, 3000);
      });
  }
  function desactivarAvisos() {
    registroListo()
      .then(function (reg) {
        return reg.pushManager.getSubscription();
      })
      .then(function (sub) {
        if (!sub) return;
        var endpoint = sub.endpoint;
        return sub.unsubscribe().then(function () {
          return NQ.llamar("push_baja", { metodo: "POST", datos: { endpoint: endpoint } }).catch(function () {});
        });
      })
      .then(function () {
        pintarAvisos(false, "🔕 Avisos desactivados.");
      })
      .catch(function (e) {
        pintarAvisos(false, "😕 " + e.message);
      });
  }

  // ----- reiniciar el viaje -----
  // Se toca dos veces para confirmar (sin ventanas emergentes), así un
  // niño no borra su progreso por accidente.
  var TEXTO_REINICIAR = "↺ Reiniciar mi viaje",
    esperaReinicio = null;
  function reiniciarViaje() {
    var b = $("[data-reiniciar]");
    if (!esperaReinicio) {
      b.textContent = "⚠️ ¿Seguro? Toca otra vez para borrar todo";
      b.classList.add("confirmar");
      esperaReinicio = setTimeout(function () {
        esperaReinicio = null;
        b.textContent = TEXTO_REINICIAR;
        b.classList.remove("confirmar");
      }, 4000);
      return;
    }
    clearTimeout(esperaReinicio);
    esperaReinicio = null;
    b.disabled = true;
    b.textContent = "Borrando...";
    var servidor = tieneToken()
      ? NQ.llamar("reiniciar_tiempo", { metodo: "POST" })
      : Promise.resolve();
    servidor
      .then(function () {
        // Se conserva solo la preferencia de leer en voz alta
        estado = { vistas: {}, retos: {}, sellos: {}, autoVoz: estado.autoVoz };
        guardarEstado();
        callar();
        location.href = location.pathname;
      })
      .catch(function (e) {
        b.disabled = false;
        b.classList.remove("confirmar");
        b.textContent = TEXTO_REINICIAR;
        toast(
          "😕 No se pudo reiniciar: " +
            (e instanceof TypeError ? "no hay conexión con el servidor." : e.message),
        );
      });
  }

  // ----- arranque -----
  document.addEventListener("DOMContentLoaded", function () {
    $("[data-slider]").addEventListener("input", function (e) {
      ir(+e.target.value);
    });
    $("[data-antes]").addEventListener("click", function () {
      ir(idx - 1);
    });
    $("[data-despues]").addEventListener("click", function () {
      ir(idx + 1);
    });
    $("[data-siguiente]").addEventListener("click", siguiente);
    // Flechas del teclado para viajar (si no se está escribiendo)
    document.addEventListener("keydown", function (e) {
      if (e.target.closest && e.target.closest("input, textarea, select")) return;
      if (e.key === "ArrowLeft") ir(idx - 1);
      else if (e.key === "ArrowRight") ir(idx + 1);
    });
    window.addEventListener("hashchange", irDesdeHash);

    if (hayVoz) {
      var leerEv = $("[data-leer-evento]");
      leerEv.hidden = false;
      leerEv.addEventListener("click", function () {
        var ev = eventos[idx];
        if (ev) leer(ev.titulo + ". " + ev.texto, leerEv);
      });
      $("[data-auto-voz-caja]").hidden = false;
      var auto = $("[data-auto-voz]");
      auto.checked = !!estado.autoVoz;
      auto.addEventListener("change", function () {
        estado.autoVoz = auto.checked;
        guardarEstado();
        if (!auto.checked) callar();
      });
    }

    $("[data-orden-otra]").addEventListener("click", function () {
      if (juego.ronda >= RONDAS) nuevaPartida();
      else nuevaRonda();
    });
    $("[data-diploma-nombre]").addEventListener("input", function (e) {
      estado.nombre = e.target.value.trim();
      guardarEstado();
    });
    $("[data-diploma-imprimir]").addEventListener("click", function () {
      window.print();
    });

    $("[data-reiniciar]").addEventListener("click", reiniciarViaje);
    $("[data-avisos-activar]").addEventListener("click", activarAvisos);
    $("[data-avisos-probar]").addEventListener("click", probarAvisos);
    $("[data-avisos-desactivar]").addEventListener("click", desactivarAvisos);
    revisarAvisos();

    cargar()
      .then(sincronizar)
      .then(function () {
        if (!eventos.length) {
          aviso("Aún no hay etapas cargadas.");
          return;
        }
        // Sellos de etapas ya completas (por ejemplo, recuperadas del
        // servidor): se marcan sin festejo
        etapas.forEach(function (et) {
          if (!estado.sellos[et.id] && etapaCompleta(et)) {
            estado.sellos[et.id] = true;
          }
        });
        guardarEstado();
        dibujarControles();
        pintarSellos();
        // Continúa donde se quedó la última vez
        if (!irDesdeHash()) ir(Math.min(estado.ultimo || 0, tope()));
        if (contarSellos() === etapas.length) mostrarDiploma(false);
        if (eventos.length > 1) {
          $("[data-orden]").hidden = false;
          nuevaPartida();
        }
      })
      .catch(function () {
        aviso(
          location.protocol === "file:"
            ? "Abre la página desde MAMP (por ejemplo http://localhost:81/NOVA-QUEST/linea-tiempo.html), no con doble clic."
            : "No pude conectar con el servidor. Revisa que MAMP esté encendido y vuelve a cargar la página.",
        );
      });
  });
})();
