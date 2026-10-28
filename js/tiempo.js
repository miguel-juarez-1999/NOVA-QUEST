/* Viaje en el tiempo: línea de tiempo + historieta + reto */
(function () {
  "use strict";
  var $ = function (s) {
    return document.querySelector(s);
  };
  var ICONOS = {
    planeta: "🌍",
    luna: "🌙",
    microbio: "🦠",
    mar: "🐚",
    dinosaurio: "🦖",
    asteroide: "☄️",
    humano: "🧑",
  };
  var COLORES = [
    ["#7a1f0f", "#ff7a2f"],
    ["#0b3d5c", "#2bb3c0"],
    ["#14532d", "#6fcf6a"],
    ["#4a2c0a", "#d9a441"],
    ["#12348f", "#46b6ff"],
  ];
  // Escenas: fondo + elementos [emoji, x%, y%, tamaño px]
  var ESCENAS = {
    polvo: {
      bg: "linear-gradient(#0a0a1f,#2a1a3a)",
      it: [
        ["✨", 15, 25, 26],
        ["☁️", 60, 30, 46],
        ["🪨", 80, 70, 34],
        ["🪨", 30, 75, 28],
        ["🧑‍🚀", 50, 65, 44],
      ],
    },
    lava: {
      bg: "linear-gradient(#3a0a05,#e8501a)",
      it: [
        ["🌋", 30, 62, 56],
        ["🔥", 70, 70, 40],
        ["🔥", 55, 40, 28],
        ["🧑‍🚀", 80, 40, 40],
      ],
    },
    choque: {
      bg: "linear-gradient(#050816,#1c2a6b)",
      it: [
        ["🌍", 30, 60, 70],
        ["🪐", 78, 35, 44],
        ["💥", 55, 48, 40],
        ["🧑‍🚀", 82, 78, 36],
      ],
    },
    luna: {
      bg: "linear-gradient(#050816,#1c2a6b)",
      it: [
        ["🌍", 30, 60, 66],
        ["🌙", 72, 35, 50],
        ["⭐", 85, 15, 20],
        ["⭐", 12, 18, 18],
        ["🧑‍🚀", 78, 78, 36],
      ],
    },
    microbio: {
      bg: "linear-gradient(#0b3d5c,#2bb3c0)",
      it: [
        ["🦠", 30, 45, 46],
        ["🦠", 62, 60, 36],
        ["🫧", 78, 30, 30],
        ["🫧", 15, 75, 24],
        ["🧑‍🚀", 80, 78, 36],
      ],
    },
    mar: {
      bg: "linear-gradient(#58c4ff,#0b4a86)",
      it: [
        ["🐚", 25, 72, 36],
        ["🪼", 60, 40, 44],
        ["🐟", 78, 62, 34],
        ["🌿", 45, 80, 32],
        ["🧑‍🚀", 88, 30, 34],
      ],
    },
    dinos: {
      bg: "linear-gradient(#9be3ff,#6fcf6a 70%)",
      it: [
        ["🦖", 35, 62, 68],
        ["🌴", 78, 58, 52],
        ["🦕", 62, 50, 40],
        ["☀️", 85, 15, 30],
        ["🧑‍🚀", 12, 78, 34],
      ],
    },
    asteroide: {
      bg: "linear-gradient(#ffb36b,#c0341d)",
      it: [
        ["☄️", 60, 28, 64],
        ["🦖", 22, 70, 48],
        ["🔥", 75, 74, 36],
        ["🧑‍🚀", 88, 80, 34],
      ],
    },
    humano: {
      bg: "linear-gradient(#9be3ff,#f3e5b0 75%)",
      it: [
        ["🧑", 30, 62, 52],
        ["🔥", 52, 72, 34],
        ["🏠", 76, 58, 50],
        ["🌳", 12, 62, 40],
        ["🧑‍🚀", 90, 80, 32],
      ],
    },
  };

  var etapas = [],
    eventos = [],
    idx = 0,
    vistas = {},
    token = null;

  function aviso(t) {
    var a = $("[data-aviso]");
    a.textContent = t;
    a.hidden = !t;
  }
  function hace(m) {
    m = parseFloat(m);
    if (m >= 1)
      return (
        "Hace " + Math.round(m).toLocaleString("es-MX") + " millones de años"
      );
    return "Hace " + Math.round(m * 1e6).toLocaleString("es-MX") + " años";
  }
  function hora(m) {
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
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

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

  function dibujarControles() {
    var chips = $("[data-chips]");
    chips.innerHTML = "";
    etapas.forEach(function (et, i) {
      var b = el("button", "chip", et.nombre);
      b.type = "button";
      b.dataset.i = i;
      b.addEventListener("click", function () {
        var p = eventos.findIndex(function (e) {
          return e._ei === i;
        });
        if (p >= 0) ir(p);
      });
      chips.appendChild(b);
    });
    var s = $("[data-slider]");
    s.max = Math.max(0, eventos.length - 1);
    var m = $("[data-marcas]");
    m.innerHTML = "";
    eventos.forEach(function (ev, i) {
      var li = el("li");
      var b = el("button", null, ICONOS[ev.icono] || "⭐");
      b.type = "button";
      b.setAttribute("aria-label", ev.titulo);
      b.addEventListener("click", function () {
        ir(i);
      });
      li.appendChild(b);
      m.appendChild(li);
    });
  }

  function panel(v, n) {
    var esc = ESCENAS[v.escena] || ESCENAS.polvo;
    var f = el("figure", "panel nueva");
    f.appendChild(el("span", "panel-num", String(n)));
    var sc = el("div", "panel-escena");
    sc.style.background = esc.bg;
    sc.setAttribute("role", "img");
    sc.setAttribute("aria-label", "Escena de la historieta " + n);
    esc.it.forEach(function (it) {
      var s = el("span", "item", it[0]);
      s.style.left = it[1] + "%";
      s.style.top = it[2] + "%";
      s.style.fontSize = it[3] + "px";
      sc.appendChild(s);
    });
    f.appendChild(sc);
    f.appendChild(el("p", "globo", v.dialogo));
    return f;
  }

  var mostradas = 0;
  function historieta(reset) {
    var ev = eventos[idx],
      vs = ev.vinetas || [];
    var sec = $("[data-historieta]");
    sec.hidden = vs.length === 0;
    var comic = $("[data-comic]");
    if (reset) {
      comic.innerHTML = "";
      mostradas = 0;
    }
    if (!vs.length) return;
    if (mostradas === 0) {
      comic.appendChild(panel(vs[0], 1));
      mostradas = 1;
    }
    var btn = $("[data-siguiente]");
    btn.disabled = mostradas >= vs.length;
    btn.textContent =
      mostradas >= vs.length ? "¡Fin de la historieta!" : "Siguiente viñeta →";
    guardar(ev, mostradas);
  }
  function siguiente() {
    var vs = eventos[idx].vinetas || [];
    if (mostradas >= vs.length) return;
    $("[data-comic]").appendChild(panel(vs[mostradas], mostradas + 1));
    mostradas++;
    historieta(false);
  }
  function guardar(ev, n) {
    if (!localStorage.getItem("nq_token")) return;
    var k = ev._et.id;
    vistas[k] = Math.max(vistas[k] || 0, n);
    NQ.llamar("etapa_progreso", {
      metodo: "POST",
      datos: { etapa_id: k, vinetas_vistas: vistas[k] },
    }).catch(function () {});
  }

  function ir(i) {
    idx = Math.max(0, Math.min(eventos.length - 1, i));
    var ev = eventos[idx],
      et = ev._et,
      col = COLORES[ev._ei % COLORES.length];
    $("[data-slider]").value = idx;
    document.querySelectorAll(".chip").forEach(function (c) {
      c.setAttribute("aria-pressed", String(+c.dataset.i === ev._ei));
    });
    document.querySelectorAll("[data-marcas] button").forEach(function (b, k) {
      if (k === idx) b.setAttribute("aria-current", "true");
      else b.removeAttribute("aria-current");
    });
    var esc = $("[data-escena]");
    esc.style.setProperty("--c1", col[0]);
    esc.style.setProperty("--c2", col[1]);
    var ic = $("[data-icono]");
    ic.textContent = ICONOS[ev.icono] || "⭐";
    ic.style.animation = "none";
    void ic.offsetWidth;
    ic.style.animation = "";
    $("[data-hace]").textContent = hace(ev.hace_millones);
    $("[data-etapa]").textContent =
      "ETAPA " + (ev._ei + 1) + " · " + et.nombre.toUpperCase();
    $("[data-titulo]").textContent = ev.titulo;
    $("[data-texto]").textContent = ev.texto;
    $("[data-antes]").disabled = idx === 0;
    $("[data-despues]").disabled = idx === eventos.length - 1;
    var seg = ((4600 - ev.hace_millones) / 4600) * 100;
    $("[data-reloj-marca]").style.left = Math.max(0, Math.min(100, seg)) + "%";
    $("[data-reloj-texto]").innerHTML =
      "Si toda la historia de la Tierra fuera un día, esto pasó a las <b>" +
      hora(ev.hace_millones) +
      "</b>.";
    historieta(true);
    reto(et);
  }

  function reto(et) {
    var sec = $("[data-reto]"),
      lista = $("[data-reto-lista]");
    lista.innerHTML = "";
    var preg = et.reto || [];
    sec.hidden = preg.length === 0;
    if (!preg.length) return;
    $("[data-reto-etapa]").textContent = "RETO · " + et.nombre.toUpperCase();
    preg.forEach(function (p) {
      var box = el("div");
      box.appendChild(el("h3", null, p.texto));
      var ops = el("div", "reto-opciones");
      var msg = el("p", "reto-msg");
      msg.setAttribute("role", "status");
      (p.opciones || []).forEach(function (o) {
        var b = el("button", "reto-opcion", o.texto);
        b.type = "button";
        b.addEventListener("click", function () {
          if (!localStorage.getItem("nq_token")) {
            msg.textContent =
              'Para responder, primero crea tu cadete en "Jugar".';
            return;
          }
          ops.querySelectorAll("button").forEach(function (x) {
            x.disabled = true;
          });
          NQ.responder(o.id)
            .then(function (r) {
              b.classList.add(r.correcta ? "ok" : "mal");
              msg.textContent =
                (r.correcta
                  ? "¡Correcto! "
                  : "Casi, ¡inténtalo otra vez en otra visita! ") +
                (r.puntos_ganados ? "+" + r.puntos_ganados + " pts" : "");
            })
            .catch(function (e) {
              msg.textContent = e.message;
              ops.querySelectorAll("button").forEach(function (x) {
                x.disabled = false;
              });
            });
        });
        ops.appendChild(b);
      });
      box.appendChild(ops);
      box.appendChild(msg);
      lista.appendChild(box);
    });
  }

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
    cargar()
      .then(function () {
        if (!eventos.length) {
          aviso("Aún no hay etapas cargadas.");
          return;
        }
        dibujarControles();
        ir(0);
      })
      .catch(function () {
        aviso(
          "No pude conectar con el servidor. Abre el sitio desde http://localhost/APP9/ con MAMP encendido.",
        );
      });
  });
})();
