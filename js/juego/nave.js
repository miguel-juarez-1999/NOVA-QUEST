// Motor del juego de NovaQuest estilo Galaga (Phaser 3).
// Misma API que la versión anterior (Nave.crear). Cada pregunta es una oleada: los
// alienígenas comandantes (fila de arriba) llevan las respuestas y el niño dispara al
// que tiene la correcta. El juego NO sabe cuál es: cada impacto a un comandante se
// envía a la API (responder) y el servidor califica y guarda los puntos.
(() => {
  "use strict";

  // Tamaño del mundo lógico: se adapta al espacio de la arena (de extremo a extremo).
  // El lado corto mide al menos 480x640; Z es la resolución con la que se dibuja.
  let W = 480, H = 640, Z = 2;
  const SEPARACION = 46;                          // distancia entre escoltas en la formación
  const RUTA = "assets/juego/";
  const rand = (a, b) => a + Math.random() * (b - a);
  const limitar = (v, a, b) => Math.max(a, Math.min(b, v));
  const COLOR = { ok: 0xd8f34a, mal: 0xff6846, azul: 0x6fd0ff };

  // ---------- Alienígenas en pixel art ----------
  // Cada fila es la mitad izquierda + la columna central; se refleja para hacerla simétrica.
  // Dos cuadros por alienígena para que aleteen.
  const PALETA = { y: 0xffd84a, b: 0x4a8cff, r: 0xff4a5a, w: 0xffffff, g: 0x3fe08a, p: 0xa36bff };
  const SPRITES = {
    abeja: [
      ["...y...", "....y.y", "..bbyyy", ".bb.yry", "bb..yyy", "b...ryr", "....yyy", "...y..y", "..y...."],
      ["...y...", "....y.y", "b...yyy", "bb.byry", ".bbbyyy", "....ryr", "....yyy", "....y.y", "...y..."]
    ],
    mariposa: [
      ["r......", "rr..b.b", "rrr.www", ".rrrwbw", "..rrwww", ".rrrwbw", "rrr.www", "rr...b.", "r......"],
      [".......", "..r.b.b", ".rr.www", "rrrrwbw", "rrrrwww", "rrrrwbw", ".rr.www", "..r..b.", "......."]
    ],
    comandante: [
      ["......gg", ".....ggg", "....gpgp", "..ppgggg", ".pppgwgw", "pppggggg", "pp..gpgp", "p...g..g", "...g...."],
      ["......gg", ".....ggg", "....gpgp", "p..pgggg", "pp.pgwgw", "pppggggg", ".pppgpgp", "...pg..g", "...g...."]
    ]
  };
  const PIXEL = 6;
  const ESCALA = { abeja: 0.42, mariposa: 0.42, comandante: 0.5 };
  const RADIO = { abeja: 15, mariposa: 15, comandante: 20 };
  const BAJO_ETIQUETA = 20;                       // distancia del comandante a su etiqueta

  function texturaPixel(escena, clave, mitades) {
    const filas = mitades.map((f) => f + [...f.slice(0, -1)].reverse().join(""));
    const ancho = Math.max(...filas.map((f) => f.length));
    const g = escena.add.graphics();
    filas.forEach((fila, y) => [...fila].forEach((ch, x) => {
      if (PALETA[ch] !== undefined) g.fillStyle(PALETA[ch], 1).fillRect(x * PIXEL, y * PIXEL, PIXEL, PIXEL);
    }));
    g.generateTexture(clave, ancho * PIXEL, filas.length * PIXEL);
    g.destroy();
  }

  // Curva de Bézier cúbica: las rutas de entrada y de picada
  function bezier(p, t) {
    const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    return { x: a * p[0].x + b * p[1].x + c * p[2].x + d * p[3].x, y: a * p[0].y + b * p[1].y + c * p[2].y + d * p[3].y };
  }

  function crear(canvas, opciones) {
    const cb = Object.assign({
      responder: async () => ({}), alRespuesta() {}, alHud() {}, alTerminar() {}, alPerder() {}, alError() {}
    }, opciones);

    // ---------- Estado (no depende de Phaser) ----------
    const s = {
      modo: "espera",            // espera | jugando | pausa | perdio | fin
      preguntas: [], indice: 0, vidas: 3, puntos: 0, t: 0,
      nave: { x: W / 2, y: H - 84 }, objetivoX: W / 2, enfriar: 0, inmune: 0, doble: 0,
      balas: [], disparos: [], aliens: [], premios: [], jefe: null, jefeDerrotado: false,
      entreOlas: 0, hechaOla: false, ultima: null, sigPicada: 3, formX: 0,
      fase: "ataque", esperaRespuestas: 0,         // ataque: oleada de escoltas | respuestas: llegan los comandantes
      combo: 0, comboMax: 0, fallos: 0, derribados: 0, tema: "tierra"
    };
    const teclas = { izq: false, der: false, fuego: false };
    const puntero = { fuego: false };
    let sc = null, listo = false, pendientes = [], sonidoActivo = true, audio = null, musica = null;
    const cuandoListo = (fn) => (listo ? fn() : pendientes.push(fn));

    // ---------- Sonido (WebAudio, sin archivos) ----------
    function ctxAudio() {
      try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === "suspended") audio.resume(); } catch { audio = null; }
      return audio;
    }
    function tono(f1, f2, dur, tipo = "square", vol = 0.04) {
      if (!sonidoActivo || !ctxAudio()) return;
      try {
        const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime;
        o.type = tipo;
        o.frequency.setValueAtTime(f1, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(f2, 1), t + dur);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(audio.destination);
        o.start(t); o.stop(t + dur);
      } catch { /* sin audio */ }
    }
    function ruido(dur, vol = 0.05, filtro = 900) {
      if (!sonidoActivo || !ctxAudio()) return;
      try {
        const n = Math.floor(audio.sampleRate * dur), buf = audio.createBuffer(1, n, audio.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
        const src = audio.createBufferSource(), f = audio.createBiquadFilter(), g = audio.createGain();
        f.type = "lowpass"; f.frequency.value = filtro; g.gain.value = vol;
        src.buffer = buf; src.connect(f); f.connect(g); g.connect(audio.destination); src.start();
      } catch { /* sin audio */ }
    }
    // Melodía corta al empezar cada oleada
    function fanfarria() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tono(f, f, 0.14, "square", 0.025), i * 110));
    }
    // Música ambiental generativa: un acorde suave que respira
    function iniciarMusica() {
      if (musica || !sonidoActivo || !ctxAudio()) return;
      try {
        const g = audio.createGain(), f = audio.createBiquadFilter(), lfo = audio.createOscillator(), lg = audio.createGain();
        g.gain.value = 0.0001; g.gain.linearRampToValueAtTime(0.035, audio.currentTime + 3);
        f.type = "lowpass"; f.frequency.value = 700;
        lfo.frequency.value = 0.12; lg.gain.value = 250; lfo.connect(lg); lg.connect(f.frequency); lfo.start();
        const osc = [55, 82.4, 110, 164.8, 220].map((fr, i) => {
          const o = audio.createOscillator(); o.type = i % 2 ? "sine" : "triangle"; o.frequency.value = fr; o.detune.value = (i - 2) * 6;
          o.connect(f); o.start(); return o;
        });
        f.connect(g); g.connect(audio.destination);
        musica = { g, osc, lfo };
      } catch { musica = null; }
    }
    function pararMusica() {
      if (!musica) return;
      try { musica.g.gain.linearRampToValueAtTime(0.0001, audio.currentTime + 0.6); const m = musica; setTimeout(() => { m.osc.forEach((o) => o.stop()); m.lfo.stop(); }, 700); } catch { /* nada */ }
      musica = null;
    }

    // ---------- Temas de fondo por misión ----------
    const TEMAS = {
      tierra:   { fondo: 0xffffff, luz: 0x8fd8ff },
      luna:     { fondo: 0xd6dbe8, luz: 0xe8eefc },
      satelite: { fondo: 0xb8f0e0, luz: 0x6fffe0 },
      estrella: { fondo: 0xe0b8ff, luz: 0xc08cff },
      sol:      { fondo: 0xffd9a8, luz: 0xffb347 }
    };
    function aplicarTema() {
      const t = TEMAS[s.tema] || TEMAS.tierra;
      sc.fondoImg.setTint(t.fondo); sc.luzFondo.setTint(t.luz);
    }

    // ---------- Utilidades de escena ----------
    function chispas(x, y, tinte, n = 22, vel = 220) {
      const em = sc.add.particles(x, y, "fuego", {
        speed: { min: 40, max: vel }, angle: { min: 0, max: 360 }, lifespan: { min: 350, max: 750 },
        scale: { start: 0.7, end: 0 }, alpha: { start: 1, end: 0 }, blendMode: "ADD", tint: tinte, emitting: false
      }).setDepth(9);
      em.explode(n);
      sc.time.delayedCall(900, () => em.destroy());
    }
    function destello(x, y, tinte, esc = 1.2) {
      const g = sc.add.image(x, y, "luz").setBlendMode("ADD").setTint(tinte).setScale(0.3 * esc).setAlpha(0.9).setDepth(9);
      sc.tweens.add({ targets: g, scale: 1.1 * esc, alpha: 0, duration: 380, onComplete: () => g.destroy() });
    }
    function mensaje(txt, x, y, color = "#ffffff", tam = 22) {
      const t = sc.add.text(limitar(x, 60, W - 60), y, txt, {
        fontFamily: "Archivo, Arial, sans-serif", fontSize: tam + "px", fontStyle: "800", color, stroke: "#050816", strokeThickness: 4, resolution: Z
      }).setOrigin(0.5).setDepth(10);
      sc.tweens.add({ targets: t, y: y - 46, alpha: 0, duration: 1100, ease: "Cubic.easeOut", onComplete: () => t.destroy() });
    }
    function sumarCombo() {
      s.combo += 1; s.comboMax = Math.max(s.comboMax, s.combo);
      if (s.combo >= 3 && s.combo % 3 === 0) {
        mensaje(`¡Racha x${s.combo}!`, s.nave.x, s.nave.y - 60, "#6fd0ff", 24);
        tono(700 + s.combo * 30, 1400, 0.18, "triangle", 0.045);
        if (s.combo % 12 === 0) crearPremio(rand(60, W - 60), -20, "doble");
      }
    }
    const hud = () => {
      const p = s.preguntas[s.indice];
      return { vidas: s.vidas, puntos: s.puntos, indice: s.indice, total: s.preguntas.length, texto: p ? p.texto : "" };
    };
    const quitar = (arr, o) => { const i = arr.indexOf(o); if (i >= 0) arr.splice(i, 1); };

    // ---------- Balas ----------
    function crearBala(x, y) {
      const b = sc.add.image(x, y, "bala").setBlendMode("ADD").setDepth(7).setScale(0.9);
      const halo = sc.add.image(x, y, "brillo").setBlendMode("ADD").setDepth(7).setTint(0x6fffff).setScale(0.55).setAlpha(0.8);
      s.balas.push({ x, y, img: b, halo });
    }
    function quitarBala(b) { b.img.destroy(); b.halo.destroy(); quitar(s.balas, b); }
    function dispararEnemigo(x, y, vx = limitar((s.nave.x - x) * 0.5, -110, 110)) {
      const img = sc.add.image(x, y, "balaE").setBlendMode("ADD").setDepth(7);
      img.rotation = Math.atan2(230, vx) - Math.PI / 2;
      s.disparos.push({ x, y, vx, vy: 230, img });
      tono(500, 250, 0.08, "square", 0.012);
    }
    function limpiarDisparos() { s.disparos.forEach((d) => d.img.destroy()); s.disparos = []; }

    // ---------- Premios ----------
    function crearPremio(x, y, tipo) {
      const def = { doble: ["⚡", 0x6fd0ff], escudo: ["🛡️", 0xd8f34a], reparar: ["❤️", 0xff6846] }[tipo];
      const aura = sc.add.image(0, 0, "luz").setBlendMode("ADD").setTint(def[1]).setScale(0.3).setAlpha(0.8);
      const aro = sc.add.image(0, 0, "orbe").setTint(def[1]);
      const ico = sc.add.text(0, 0, def[0], { fontSize: "20px", resolution: Z }).setOrigin(0.5);
      const c = sc.add.container(x, y, [aura, aro, ico]).setDepth(6);
      sc.tweens.add({ targets: aura, scale: 0.45, alpha: 0.4, duration: 600, yoyo: true, repeat: -1 });
      s.premios.push({ c, x, y, tipo, t: 0 });
    }
    function tomarPremio(p) {
      quitar(s.premios, p); p.c.destroy();
      destello(p.x, p.y, COLOR.ok, 1);
      if (p.tipo === "doble") { s.doble = 9; mensaje("¡Disparo doble!", s.nave.x, s.nave.y - 40, "#6fd0ff"); }
      else if (p.tipo === "escudo") { s.inmune = Math.max(s.inmune, 6); mensaje("¡Escudo extra!", s.nave.x, s.nave.y - 40, "#d8f34a"); }
      else if (s.vidas < 3) { s.vidas += 1; cb.alHud(hud()); mensaje("+1 escudo", s.nave.x, s.nave.y - 40, "#ff8f7a"); }
      else mensaje("¡Escudos al máximo!", s.nave.x, s.nave.y - 40, "#ff8f7a");
      tono(600, 1200, 0.2, "triangle", 0.05);
    }

    // ---------- Alienígenas ----------
    // Posición del lugar en la formación (la formación se mece de lado a lado)
    const posLugar = (a) => ({ x: a.lugar.x + s.formX, y: a.lugar.y + Math.sin(s.t * 1.6 + a.lugar.x * 0.02) * 3 });

    // Ruta de entrada: los comandantes bajan desde arriba; los escoltas entran por los lados
    // haciendo un rizo. El último punto (null) es el lugar en la formación, que se mueve.
    function rutaEntrada(lugar, lado, desdeArriba) {
      if (desdeArriba) return [{ x: W / 2 + lado * 60, y: -40 }, { x: W / 2 - lado * Math.min(170, W * 0.35), y: 300 }, { x: lugar.x + lado * 40, y: 280 }, null];
      return [{ x: lado < 0 ? -30 : W + 30, y: H * 0.6 }, { x: lado < 0 ? W * 0.7 : W * 0.3, y: H * 0.84 }, { x: lado < 0 ? W * 0.9 : W * 0.1, y: 120 }, null];
    }

    function crearAlien(tipo, lugar, ruta, retraso) {
      const img = sc.add.image(ruta[0].x, ruta[0].y, tipo + "1").setScale(ESCALA[tipo]).setDepth(6).setVisible(false);
      const a = { tipo, img, lugar, ruta, x: ruta[0].x, y: ruta[0].y, estado: "entra", t: -retraso, dur: 2, r: RADIO[tipo], cuadro: "1" };
      s.aliens.push(a);
      return a;
    }

    // Etiqueta con la respuesta que carga cada comandante
    function crearEtiqueta(o, ancho) {
      const txt = sc.add.text(0, 0, o.texto, {
        fontFamily: "Archivo, Arial, sans-serif", fontSize: "13px", fontStyle: "700", color: "#ffffff", align: "center",
        wordWrap: { width: ancho - 16 }, resolution: Z
      }).setOrigin(0.5);
      const h = Math.max(38, txt.height + 16);
      const luz = sc.add.image(0, 0, "luz").setBlendMode("ADD").setTint(COLOR.azul).setDisplaySize(ancho * 1.5, h * 2).setAlpha(0.3);
      const fondo = sc.add.image(0, 0, "capsula").setDisplaySize(ancho, h);
      const c = sc.add.container(0, 0, [luz, fondo, txt]).setDepth(6).setAlpha(0);
      sc.tweens.add({ targets: luz, alpha: 0.1, duration: 700, yoyo: true, repeat: -1 });
      return { c, w: ancho, h };
    }

    function destruirAlien(a) { a.img.destroy(); if (a.opcion) a.opcion.c.destroy(); }
    function limpiarAliens() { s.aliens.forEach(destruirAlien); s.aliens = []; }

    function explotar(a, grande = false) {
      if (!a.img.visible) return;
      const tintes = { abeja: [0xffd84a, 0x4a8cff], mariposa: [0xff4a5a, 0xffffff], comandante: [0x3fe08a, 0xa36bff] }[a.tipo];
      chispas(a.x, a.y, grande ? [0xd8f34a, 0xffffff] : tintes, grande ? 40 : 18, grande ? 260 : 200);
      destello(a.x, a.y, grande ? COLOR.ok : tintes[0], grande ? 1.6 : 0.8);
    }

    function derribar(a) {
      a.muerto = true; s.derribados += 1;
      explotar(a);
      ruido(0.18, 0.04, 1000); tono(400, 120, 0.12, "square", 0.025);
      sumarCombo();
      if (Math.random() < 0.06) crearPremio(a.x, a.y, ["doble", "escudo", "reparar"][Math.floor(Math.random() * 3)]);
    }

    // Un escolta sale de la formación, hace un rizo y se lanza hacia la nave
    function iniciarPicada(a) {
      const dir = a.x < W / 2 ? -1 : 1;
      const objetivo = limitar(s.nave.x + rand(-40, 40), 30, W - 30);
      a.ruta = [{ x: a.x, y: a.y }, { x: a.x + dir * 90, y: a.y - 70 }, { x: objetivo - dir * 60, y: H * 0.5 }, { x: objetivo + dir * 80, y: H + 50 }];
      a.estado = "pica"; a.t = 0; a.dur = Math.max(1.9, 2.6 - s.indice * 0.1);
      a.tiros = a.tipo === "mariposa" ? [0.35, 0.5] : [0.42];
      tono(1200, 300, 0.45, "triangle", 0.02);
    }

    // ---------- Oleadas ----------
    // Cada pregunta tiene dos fases: primero una oleada de ataque que hay que despejar
    // y después llegan los comandantes con las respuestas.
    function nuevaOla() {
      s.hechaOla = false; s.entreOlas = 0; s.esperaRespuestas = 0;
      limpiarAliens(); limpiarDisparos();
      if (s.fase === "respuestas") oleadaRespuestas(); else oleadaAtaque();
      cb.alHud(hud());
    }

    function oleadaAtaque() {
      s.fase = "ataque";
      // Más columnas mientras más ancha es la pantalla; más filas conforme avanza la misión
      const columnas = limitar(Math.floor((W - 60) / SEPARACION / 2) * 2, 6, 12);
      const filas = s.indice === 0 ? ["mariposa", "abeja"] : ["mariposa", "mariposa", "abeja"];
      filas.forEach((tipo, f) => {
        for (let k = 0; k < columnas; k++) {
          const lugar = { x: W / 2 + (k - (columnas - 1) / 2) * SEPARACION, y: 80 + f * 42 };
          crearAlien(tipo, lugar, rutaEntrada(lugar, k < columnas / 2 ? -1 : 1, false), 0.4 + f * 0.7 + (k % (columnas / 2)) * 0.11);
        }
      });
      s.sigPicada = 3;
      mensaje(`OLEADA ${s.indice + 1}`, W / 2, H / 2, "#d8f34a", 30);
      fanfarria();
    }

    function oleadaRespuestas() {
      s.fase = "respuestas";
      const opciones = s.preguntas[s.indice].opciones;
      const n = opciones.length, carril = W / n, ancho = Math.min(170, carril - 12);
      opciones.forEach((o, i) => {
        const lugar = { x: carril * (i + 0.5), y: 74 };
        const a = crearAlien("comandante", lugar, rutaEntrada(lugar, i < n / 2 ? -1 : 1, true), i * 0.18);
        a.opcion = Object.assign({ id: o.id }, crearEtiqueta(o, ancho));
      });
      s.sigPicada = 3.5;
      mensaje("¡Llegan las respuestas!", W / 2, H / 2, "#6fd0ff", 26);
      tono(400, 900, 0.4, "triangle", 0.04);
    }

    // Respuesta correcta: toda la oleada explota en cadena
    function despejarOla(correcto) {
      const resto = s.aliens; s.aliens = [];
      limpiarDisparos();
      resto.forEach((a, i) => sc.time.delayedCall(a === correcto ? 0 : 80 + i * 45, () => {
        explotar(a, a === correcto);
        if (a !== correcto) ruido(0.12, 0.03, 1100);
        destruirAlien(a);
      }));
    }

    // ---------- Nave nodriza (jefe antes de la última pregunta) ----------
    function crearJefe() {
      const img = sc.add.image(W / 2, -80, "nodriza").setScale(0.5).setDepth(6);
      const luz = sc.add.image(W / 2, -80, "luz").setBlendMode("ADD").setTint(0xc08cff).setDisplaySize(260, 160).setAlpha(0.35).setDepth(5);
      const barra = sc.add.graphics().setDepth(8);
      const max = 18 + s.preguntas.length * 2;
      s.jefe = { img, luz, barra, x: W / 2, y: -80, hp: max, max, t: 0, sigTiro: 2, sigEscolta: 4 };
      mensaje("¡NAVE NODRIZA!", W / 2, 260, "#ff6846", 28);
      sc.cameras.main.shake(500, 0.006);
      tono(90, 60, 0.9, "sawtooth", 0.06);
    }
    function destruirJefe(j) { j.img.destroy(); j.luz.destroy(); j.barra.destroy(); }
    function dibujarBarraJefe(j) {
      j.barra.clear();
      const w = 120, x = j.x - w / 2, y = j.y - 50;
      j.barra.fillStyle(0x050816, 0.8).fillRect(x - 2, y - 2, w + 4, 10);
      j.barra.fillStyle(0xff6846, 1).fillRect(x, y, w * (j.hp / j.max), 6);
    }
    function matarJefe() {
      const j = s.jefe; s.jefe = null; s.jefeDerrotado = true;
      chispas(j.x, j.y, [0xc08cff, 0xff6846, 0xffffff], 70, 320);
      destello(j.x, j.y, 0xc08cff, 2.4);
      sc.cameras.main.shake(450, 0.014); sc.cameras.main.flash(250, 255, 200, 120);
      mensaje("¡Nave nodriza destruida!", W / 2, 260, "#d8f34a", 24);
      ruido(0.7, 0.09, 1200); tono(160, 40, 0.6, "sawtooth", 0.07);
      crearPremio(j.x, j.y, "reparar");
      destruirJefe(j); limpiarDisparos();
      s.fase = "respuestas";        // la nodriza cuenta como la oleada de ataque
      s.entreOlas = 1.4;
    }
    function actualizarJefe(dt) {
      const j = s.jefe;
      j.t += dt;
      j.y += (130 - j.y) * Math.min(1, dt * 1.2);
      j.x = W / 2 + Math.sin(j.t * 0.7) * Math.max(140, W / 2 - 110);
      j.img.setPosition(j.x, j.y);
      j.luz.setPosition(j.x, j.y).setAlpha(0.3 + Math.sin(j.t * 4) * 0.1);
      const bala = s.balas.find((b) => Math.abs(b.x - j.x) < 75 && Math.abs(b.y - j.y) < 30);
      if (bala) {
        quitarBala(bala); j.hp -= 1; j.img.setTint(0xff9a7a); sc.time.delayedCall(70, () => j.img.active && j.img.clearTint());
        chispas(bala.x, bala.y, 0xc08cff, 5, 120); tono(240, 120, 0.05, "square", 0.025);
        if (j.hp <= 0) { matarJefe(); return; }
      }
      if (j.y > 100) {
        // Ráfaga de tres disparos en abanico
        j.sigTiro -= dt;
        if (j.sigTiro <= 0) { [-90, 0, 90].forEach((vx) => dispararEnemigo(j.x, j.y + 30, vx)); j.sigTiro = rand(1.3, 1.9); }
        // Suelta abejas que se lanzan contra la nave
        j.sigEscolta -= dt;
        if (j.sigEscolta <= 0) {
          [-40, 40].forEach((dx) => iniciarPicada(crearAlien("abeja", null, [{ x: j.x + dx, y: j.y + 20 }], 0)));
          j.sigEscolta = 5;
        }
      }
      dibujarBarraJefe(j);
    }

    // ---------- Respuestas ----------
    async function resolver(a) {
      a.resolviendo = true; a.img.setAlpha(0.6); a.opcion.c.setAlpha(0.55);
      try {
        const r = await cb.responder(a.opcion.id);
        cb.alRespuesta(r);
        if (s.hechaOla || !s.aliens.includes(a)) return;   // respuesta tardía de una oleada ya cerrada
        if (r.correcta) {
          s.puntos += r.puntos_ganados; s.ultima = r;
          sc.cameras.main.flash(160, 216, 243, 74);
          mensaje(r.puntos_ganados > 0 ? `+${r.puntos_ganados}` : "¡Correcto!", a.x, a.y + 40, "#d8f34a", 28);
          s.hechaOla = true; s.entreOlas = 1.8;
          despejarOla(a);
          tono(520, 1040, 0.25, "triangle", 0.06); setTimeout(() => tono(780, 1560, 0.3, "triangle", 0.05), 120);
          cb.alHud(hud());
        } else {
          chispas(a.x, a.y, [0xff6846, 0xffb347], 26); destello(a.x, a.y, COLOR.mal, 1.2);
          mensaje("¡Casi!", a.x, a.y + 40, "#ff6846");
          a.muerto = true;
          tono(220, 70, 0.3, "sawtooth", 0.05); ruido(0.25, 0.05, 700);
          perderEscudo();
        }
      } catch (error) {
        a.resolviendo = false; a.img.setAlpha(1); a.opcion.c.setAlpha(1);
        cb.alError(error);
      }
    }

    function perderEscudo() {
      if (s.vidas <= 0 || s.modo === "espera" || s.modo === "fin") return;
      s.vidas -= 1; s.inmune = 1.6; s.doble = 0; s.combo = 0; s.fallos += 1;
      sc.cameras.main.shake(260, 0.012);
      cb.alHud(hud());
      if (s.vidas <= 0) {
        s.modo = "perdio";
        chispas(s.nave.x, s.nave.y, [0xff6846, 0xffb347, 0xffffff], 60, 300); destello(s.nave.x, s.nave.y, COLOR.mal, 2);
        tono(200, 40, 0.7, "sawtooth", 0.07); ruido(0.8, 0.09, 1400);
        pararMusica();
        cb.alPerder();
      }
    }
    function terminar() {
      s.modo = "fin"; pararMusica();
      cb.alTerminar({ puntos: s.puntos, ultima: s.ultima, vidas: s.vidas, fallos: s.fallos, racha: s.comboMax, aliens: s.derribados });
    }

    // ---------- Actualización ----------
    function actualizarFondo(dt) {
      s.t += dt;
      sc.estrellas1.tilePositionY -= 18 * dt; sc.estrellas2.tilePositionY -= 46 * dt;
      sc.lejanas.forEach((a) => {
        a.y += a.v * dt; a.rotation += a.vr * dt;
        if (a.y > H + 200) { a.y = -200; a.x = rand(0, W); }
      });
      sc.luzFondo.setAlpha(0.22 + Math.sin(s.t * 0.7) * 0.07);
    }

    function actualizarAliens(dt) {
      s.formX = Math.sin(s.t * 0.6) * 16;
      const cuadro = Math.floor(s.t * 2.5) % 2 ? "2" : "1";
      for (const a of s.aliens) {
        if (a.muerto) continue;
        a.t += dt;
        if (a.t < 0) continue;
        a.img.setVisible(true);
        const antes = { x: a.x, y: a.y };
        if (a.estado === "entra" || a.estado === "pica") {
          if (a.estado === "entra") a.ruta[3] = posLugar(a);
          const k = Math.min(1, a.t / a.dur);
          Object.assign(a, bezier(a.ruta, k));
          if (a.estado === "pica") {
            while (a.tiros.length && k >= a.tiros[0]) { a.tiros.shift(); if (a.y < s.nave.y - 80) dispararEnemigo(a.x, a.y + 10); }
          }
          if (k >= 1) {
            if (a.estado === "entra") a.estado = "formado";
            else if (a.lugar) { a.estado = "regresa"; a.y = -30; }
            else a.muerto = true;      // abeja de la nodriza: se va de la pantalla
          }
        } else if (a.estado === "regresa") {
          const d = posLugar(a);
          a.x = d.x; a.y = Math.min(d.y, a.y + 170 * dt);
          if (a.y >= d.y) a.estado = "formado";
        } else {
          Object.assign(a, posLugar(a));
        }
        // Gira hacia donde vuela; en formación mira al frente
        if (a.estado === "entra" || a.estado === "pica") {
          if (Math.hypot(a.x - antes.x, a.y - antes.y) > 0.2) a.img.rotation = Math.atan2(a.y - antes.y, a.x - antes.x) + Math.PI / 2;
        } else a.img.rotation *= Math.max(0, 1 - dt * 8);
        if (a.cuadro !== cuadro) { a.cuadro = cuadro; a.img.setTexture(a.tipo + cuadro); }
        a.img.setPosition(a.x, a.y);
        if (a.opcion) {
          a.opcion.c.setPosition(a.x, a.y + BAJO_ETIQUETA + a.opcion.h / 2);
          if (a.estado === "formado" && !a.resolviendo) a.opcion.c.setAlpha(Math.min(1, a.opcion.c.alpha + dt * 3));
        }

        // Impactos
        if (a.opcion) {
          if (a.estado !== "formado" || a.resolviendo || s.modo !== "jugando") continue;
          const o = a.opcion, abajo = a.y + BAJO_ETIQUETA + o.h;
          const bala = s.balas.find((b) => Math.abs(b.x - a.x) < o.w / 2 && b.y > a.y - 16 && b.y < abajo);
          if (bala) { quitarBala(bala); resolver(a); }
        } else {
          const bala = s.balas.find((b) => Math.hypot(b.x - a.x, b.y - a.y) < a.r + 4);
          if (bala) { quitarBala(bala); derribar(a); }
          else if (a.estado === "pica" && s.inmune <= 0 && s.modo === "jugando" && Math.hypot(s.nave.x - a.x, s.nave.y - a.y) < a.r + 14) {
            a.muerto = true; explotar(a);
            mensaje("¡Cuidado!", s.nave.x, s.nave.y - 34, "#ff6846");
            tono(180, 50, 0.3, "sawtooth", 0.06); ruido(0.3, 0.06, 800);
            perderEscudo();
          }
        }
      }
      s.aliens = s.aliens.filter((a) => { if (a.muerto) { destruirAlien(a); return false; } return true; });

      // Oleada de ataque despejada: llegan las respuestas
      if (s.fase === "ataque" && !s.jefe && s.aliens.length === 0 && s.esperaRespuestas <= 0 && s.entreOlas <= 0 && s.modo === "jugando") {
        mensaje("¡Oleada despejada!", W / 2, H / 2, "#d8f34a", 28);
        tono(660, 1320, 0.3, "triangle", 0.05);
        s.esperaRespuestas = 1.5;
      }

      // Escoltas que salen en picada; con las respuestas en pantalla llegan abejas sueltas
      s.sigPicada -= dt;
      if (s.sigPicada <= 0 && !s.hechaOla) {
        if (s.fase === "ataque") {
          const libres = s.aliens.filter((a) => a.estado === "formado");
          const picando = s.aliens.filter((a) => a.estado === "pica").length;
          const max = 2 + Math.min(2, Math.floor(s.indice / 2)) + (W > 800 ? 1 : 0);
          if (libres.length && picando < max) iniciarPicada(libres[Math.floor(Math.random() * libres.length)]);
          s.sigPicada = Math.max(0.6, rand(1.1, 1.9) - s.indice * 0.15);
        } else if (s.aliens.some((a) => a.opcion && a.estado === "formado")) {
          const tipo = s.indice >= 1 && Math.random() < 0.5 ? "mariposa" : "abeja";
          iniciarPicada(crearAlien(tipo, null, [{ x: rand(60, W - 60), y: -30 }], 0));
          s.sigPicada = Math.max(1.6, rand(2.6, 3.6) - s.indice * 0.2);
        }
      }
    }

    function actualizar(dt) {
      s.inmune = Math.max(0, s.inmune - dt);
      s.doble = Math.max(0, s.doble - dt);

      // Nave
      if (teclas.izq) s.objetivoX -= 330 * dt;
      if (teclas.der) s.objetivoX += 330 * dt;
      s.objetivoX = limitar(s.objetivoX, 26, W - 26);
      const antes = s.nave.x;
      s.nave.x += (s.objetivoX - s.nave.x) * Math.min(1, dt * 12);
      const vx = (s.nave.x - antes) / Math.max(dt, 0.001);
      sc.nave.setAngle(limitar(vx * 0.04, -14, 14));

      // Disparo
      s.enfriar -= dt;
      if ((teclas.fuego || puntero.fuego) && s.enfriar <= 0) {
        if (s.doble > 0) { crearBala(s.nave.x - 9, s.nave.y - 26); crearBala(s.nave.x + 9, s.nave.y - 26); }
        else crearBala(s.nave.x, s.nave.y - 30);
        s.enfriar = 0.21;
        tono(1100, 380, 0.08, "square", 0.022);
      }
      for (const b of s.balas) { b.y -= 600 * dt; b.img.y = b.y; b.halo.y = b.y + 6; }
      s.balas = s.balas.filter((b) => { if (b.y < -30) { b.img.destroy(); b.halo.destroy(); return false; } return true; });

      actualizarAliens(dt);
      if (s.jefe) actualizarJefe(dt);
      if (s.esperaRespuestas > 0) {
        s.esperaRespuestas -= dt;
        if (s.esperaRespuestas <= 0 && !s.hechaOla) { limpiarDisparos(); oleadaRespuestas(); }
      }

      // Disparos enemigos (el escudo extra los desintegra)
      for (const d of [...s.disparos]) {
        d.x += d.vx * dt; d.y += d.vy * dt; d.img.setPosition(d.x, d.y);
        const dist = Math.hypot(d.x - s.nave.x, d.y - s.nave.y);
        if (s.modo === "jugando" && s.inmune > 0 && dist < 30) {
          chispas(d.x, d.y, 0x6fd0ff, 6, 100); d.img.destroy(); quitar(s.disparos, d);
        } else if (s.modo === "jugando" && dist < 13) {
          chispas(d.x, d.y, [0xff6846, 0xffb347], 20); d.img.destroy(); quitar(s.disparos, d);
          mensaje("¡Te dieron!", s.nave.x, s.nave.y - 34, "#ff6846");
          tono(180, 50, 0.3, "sawtooth", 0.06); ruido(0.3, 0.06, 800);
          perderEscudo();
        } else if (d.y > H + 20 || d.x < -20 || d.x > W + 20) { d.img.destroy(); quitar(s.disparos, d); }
      }

      // Premios
      for (const p of [...s.premios]) {
        p.y += 70 * dt; p.t += dt; p.c.y = p.y; p.c.x = p.x + Math.sin(p.t * 3) * 6;
        if (Math.hypot(s.nave.x - p.c.x, s.nave.y - p.y) < 30) tomarPremio(p);
        else if (p.y > H + 30) { p.c.destroy(); quitar(s.premios, p); }
      }

      // Entre oleadas
      if (s.modo === "jugando" && s.entreOlas > 0) {
        s.entreOlas -= dt;
        if (s.entreOlas <= 0) {
          if (s.hechaOla) {
            s.indice += 1;
            s.hechaOla = false; s.fase = "ataque";
            if (s.indice >= s.preguntas.length) { terminar(); return; }
          }
          // Nave nodriza antes de la última pregunta
          if (s.indice === s.preguntas.length - 1 && s.preguntas.length > 1 && !s.jefeDerrotado && !s.jefe) { crearJefe(); return; }
          nuevaOla();
        }
      }
    }

    function dibujarNave() {
      const visible = s.modo !== "perdio";
      sc.nave.setVisible(visible); sc.estela.emitting = visible; sc.aura.setVisible(visible && s.inmune > 0);
      if (!visible) return;
      sc.nave.setPosition(s.nave.x, s.nave.y);
      sc.nave.setAlpha(s.inmune > 0 && s.inmune < 2 && Math.floor(s.t * 14) % 2 === 0 ? 0.35 : 1);
      sc.aura.setPosition(s.nave.x, s.nave.y).setAlpha(0.35 + Math.sin(s.t * 8) * 0.12);
    }

    // ---------- Tamaño del mundo ----------
    // Mide la arena y calcula W y H para que el juego la llene sin deformarse.
    function medir() {
      const caja = canvas.parentElement.getBoundingClientRect();
      if (caja.width < 50 || caja.height < 50) return false;
      const aspecto = limitar(caja.width / caja.height, 0.45, 2.6);
      if (aspecto >= 0.75) { H = 640; W = Math.round(640 * aspecto); }
      else { W = 480; H = Math.round(480 / aspecto); }
      Z = Math.min(2, 2600 / W, 2000 / H);
      return true;
    }
    // Acomoda el fondo, la Tierra, la cámara y la nave al tamaño actual
    function maquetar(anchoAntes = W) {
      sc.cameras.main.setSize(Math.round(W * Z), Math.round(H * Z)).setZoom(Z).centerOn(W / 2, H / 2);
      const f = sc.textures.get("fondo").getSourceImage();
      sc.fondoImg.setPosition(W / 2, H / 2).setScale(Math.max(W / f.width, H / f.height));
      sc.luzFondo.setPosition(W * 0.62, H * 0.25);
      [sc.estrellas1, sc.estrellas2].forEach((e) => e.setPosition(W / 2, H / 2).setSize(W, H));
      const alto = W * 360 / 1024;
      // El borde del planeta (a 40% de la imagen) siempre asoma 85 px sobre el fondo
      sc.tierra.setDisplaySize(W, alto).setPosition(W / 2, H - 85 + alto * 0.1);
      sc.halo.setPosition(W / 2, H + 12).setDisplaySize(W * 1.4, 240);
      s.nave.y = H - 84;
      s.nave.x = s.objetivoX = limitar(s.nave.x * W / anchoAntes, 26, W - 26);
      s.aliens.forEach((a) => { if (a.lugar) a.lugar.x *= W / anchoAntes; });
    }
    function ajustar() {
      const antes = W;
      if (!medir() || !listo) return;
      const ancho = Math.round(W * Z), alto = Math.round(H * Z);
      if (juego.scale.width !== ancho || juego.scale.height !== alto) {
        juego.scale.resize(ancho, alto);
        canvas.style.width = "100%"; canvas.style.height = "100%";
      }
      maquetar(antes);
    }

    // ---------- Escena de Phaser ----------
    const escena = {
      key: "nq",
      preload() {
        this.load.setPath(RUTA);
        ["fondo.jpg", "estrellas1.png", "estrellas2.png", "asteroide_fondo_blur.png", "bala.png", "brillo.png",
         "fuego.png", "luz.png", "nave.png", "capsula.png", "tierra.png"]
          .forEach((f) => this.load.image(f.replace(/\.\w+$/, ""), f));
      },
      create() {
        sc = this;

        // Texturas generadas: alienígenas, aro de premios, disparo enemigo y nave nodriza
        Object.entries(SPRITES).forEach(([tipo, cuadros]) => cuadros.forEach((c, i) => texturaPixel(this, tipo + (i + 1), c)));
        const g = this.add.graphics();
        g.lineStyle(4, 0xffffff, 1).strokeCircle(24, 24, 20); g.fillStyle(0x0a1a44, 0.9).fillCircle(24, 24, 18);
        g.lineStyle(4, 0xffffff, 1).strokeCircle(24, 24, 20);
        g.generateTexture("orbe", 48, 48); g.destroy();
        const e = this.add.graphics();
        e.fillStyle(0xff6846, 1).fillRoundedRect(0, 0, 8, 18, 4); e.fillStyle(0xffe0a0, 1).fillRoundedRect(2, 3, 4, 12, 2);
        e.generateTexture("balaE", 8, 18); e.destroy();
        const n = this.add.graphics();
        n.fillStyle(0x6fd0ff, 0.9).fillEllipse(160, 48, 110, 70);
        n.fillStyle(0xffffff, 0.6).fillEllipse(140, 36, 30, 16);
        n.fillStyle(0x5a6488, 1).fillEllipse(160, 80, 310, 70);
        n.fillStyle(0x8a94b8, 1).fillEllipse(160, 72, 290, 40);
        n.fillStyle(0x3a2a6a, 1).fillEllipse(160, 102, 200, 36);
        [-120, -80, -40, 0, 40, 80, 120].forEach((dx, i) => n.fillStyle(i % 2 ? 0xd8f34a : 0xff6846, 1).fillCircle(160 + dx, 82, 7));
        n.generateTexture("nodriza", 320, 140); n.destroy();

        // Fondo en capas (parallax)
        this.fondoImg = this.add.image(W / 2, H / 2, "fondo").setDisplaySize(W, H).setDepth(0);
        this.luzFondo = this.add.image(W * 0.62, H * 0.25, "luz").setBlendMode("ADD").setScale(3.2).setAlpha(0.22).setDepth(0);
        this.estrellas1 = this.add.tileSprite(W / 2, H / 2, W, H, "estrellas1").setDepth(1);
        this.estrellas2 = this.add.tileSprite(W / 2, H / 2, W, H, "estrellas2").setDepth(1);
        this.lejanas = [];
        for (let i = 0; i < 4; i++) {
          const a = this.add.image(rand(0, W), rand(-100, H), "asteroide_fondo_blur").setDepth(2)
            .setScale(rand(0.8, 1.7)).setAlpha(rand(0.35, 0.6)).setTint(0x7fa8d8);
          a.v = rand(7, 20); a.vr = rand(-0.05, 0.05); this.lejanas.push(a);
        }
        // La Tierra, asomando abajo, con halo de atmósfera
        this.halo = this.add.image(W / 2, H + 12, "luz").setBlendMode("ADD").setTint(0x4aa3ff).setAlpha(0.55).setDepth(3);
        this.tierra = this.add.image(W / 2, H - 72, "tierra").setDepth(3);

        // Nave + estela de motor + aura de escudo
        this.estela = this.add.particles(0, 0, "fuego", {
          speedY: { min: 90, max: 200 }, speedX: { min: -14, max: 14 }, lifespan: { min: 180, max: 340 },
          scale: { start: 0.65, end: 0 }, alpha: { start: 0.95, end: 0 }, blendMode: "ADD", frequency: 18,
          tint: [0xffd27a, 0xff8a3a, 0xff5a2a]
        }).setDepth(7);
        this.nave = this.add.image(s.nave.x, s.nave.y, "nave").setDisplaySize(52, 69).setDepth(8);
        this.estela.startFollow(this.nave, 0, 32);
        this.aura = this.add.image(s.nave.x, s.nave.y, "luz").setBlendMode("ADD").setTint(0x6fd0ff).setDisplaySize(110, 110).setDepth(8).setVisible(false);

        aplicarTema();
        maquetar();
        listo = true;
        pendientes.splice(0).forEach((fn) => fn());
      },
      update(_t, delta) {
        const dt = Math.min(0.05, delta / 1000);
        if (s.modo === "jugando") { actualizarFondo(dt); actualizar(dt); }
        else if (s.modo !== "pausa") actualizarFondo(dt);
        dibujarNave();
      }
    };

    function hayWebGL() {
      try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
    }
    medir();
    const juego = new Phaser.Game({
      type: hayWebGL() ? Phaser.WEBGL : Phaser.CANVAS, canvas, width: W * Z, height: H * Z, backgroundColor: "#050816",
      audio: { noAudio: true }, banner: false, scene: escena,
      input: { mouse: false, touch: false, keyboard: false, gamepad: false },
      scale: { mode: Phaser.Scale.NONE }, render: { antialias: true, powerPreference: "high-performance" }
    });
    canvas.style.width = "100%"; canvas.style.height = "100%";
    let temporizadorAjuste = 0;
    const pedirAjuste = () => { clearTimeout(temporizadorAjuste); temporizadorAjuste = setTimeout(() => cuandoListo(ajustar), 120); };
    window.addEventListener("resize", pedirAjuste);
    if (window.ResizeObserver) new ResizeObserver(pedirAjuste).observe(canvas.parentElement);

    // ---------- Controles (DOM, para que funcione igual con mouse, dedo y teclado) ----------
    const enJuego = () => s.modo === "jugando";
    window.addEventListener("keydown", (e) => {
      if (!enJuego()) return;
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") teclas.izq = true;
      else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") teclas.der = true;
      else if (e.key === " ") teclas.fuego = true;
      else return;
      e.preventDefault();
    });
    window.addEventListener("keyup", (e) => {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") teclas.izq = false;
      else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") teclas.der = false;
      else if (e.key === " ") teclas.fuego = false;
    });
    const moverA = (e) => {
      const caja = canvas.getBoundingClientRect();
      s.objetivoX = limitar((e.clientX - caja.left) * (W / caja.width), 26, W - 26);
    };
    canvas.addEventListener("pointerdown", (e) => { canvas.setPointerCapture(e.pointerId); puntero.fuego = true; moverA(e); ctxAudio(); });
    canvas.addEventListener("pointermove", moverA);
    canvas.addEventListener("pointerup", () => { puntero.fuego = false; });
    canvas.addEventListener("pointercancel", () => { puntero.fuego = false; });
    document.addEventListener("visibilitychange", () => { if (document.hidden) api.pausar(); });

    // ---------- API pública (igual que la versión anterior) ----------
    function reiniciarObjetos() {
      s.balas.forEach((b) => { b.img.destroy(); b.halo.destroy(); }); s.balas = [];
      s.premios.forEach((p) => p.c.destroy()); s.premios = [];
      if (s.jefe) { destruirJefe(s.jefe); s.jefe = null; }
      limpiarAliens(); limpiarDisparos();
    }
    const api = {
      cargar(preguntas, indice = 0, tema = "tierra") {
        s.tema = tema;
        cuandoListo(() => { reiniciarObjetos(); aplicarTema(); ajustar(); });
        Object.assign(s, { preguntas, indice, vidas: 3, puntos: 0, modo: "espera", inmune: 0, doble: 0, jefeDerrotado: false,
                           hechaOla: false, entreOlas: 0, ultima: null, combo: 0, comboMax: 0, fallos: 0, derribados: 0,
                           fase: "ataque", esperaRespuestas: 0 });
        s.nave.x = s.objetivoX = W / 2;
        cb.alHud(hud());
      },
      despegar() {
        ctxAudio(); iniciarMusica();
        cuandoListo(() => { s.modo = "jugando"; s.jefeDerrotado = false; nuevaOla(); });
      },
      reintentar() {
        cuandoListo(() => {
          reiniciarObjetos();
          // Si perdió con las respuestas en pantalla, vuelve directo a ellas
          Object.assign(s, { vidas: 3, modo: "jugando", inmune: 1.5, doble: 0, hechaOla: false, entreOlas: 0.4, esperaRespuestas: 0 });
          cb.alHud(hud());
        });
        iniciarMusica();
      },
      pausar() { if (s.modo === "jugando") { s.modo = "pausa"; } },
      reanudar() { if (s.modo === "pausa") s.modo = "jugando"; },
      sonido(activo) { sonidoActivo = activo; if (!activo) pararMusica(); else if (s.modo === "jugando") iniciarMusica(); },
      detener() {
        s.modo = "espera"; pararMusica();
        teclas.izq = teclas.der = teclas.fuego = puntero.fuego = false;
        cuandoListo(() => reiniciarObjetos());
      },
      estado: () => s   // solo para pruebas
    };
    return api;
  }

  window.Nave = { crear };
})();
