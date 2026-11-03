// Motor del juego de NovaQuest estilo Galaga (Phaser 3). Lo usan todas las misiones;
// cada una tiene su escenario (ESCENARIOS): lugar, enemigos y dificultad.
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
  const PALETA = {
    y: 0xffd84a, b: 0x4a8cff, r: 0xff4a5a, w: 0xffffff, g: 0x3fe08a, p: 0xa36bff,
    c: 0x6fffe0, m: 0xff5ad8, k: 0xa8b0c4, d: 0x4a5270, o: 0xff8a2a, l: 0xc8a8ff, s: 0xe6ebf5, n: 0x2a5fd8, f: 0xfff0a0
  };
  // Cada escenario usa tres familias: "abeja" (se lanza en picada), "mariposa" (dispara al
  // picar) y "comandante" (lleva la respuesta). Abajo están los diseños de cada una.
  const SPRITES = {
    // Órbita de la Tierra
    medusa: [
      ["...cccc", "..cccwc", "..ccccc", ".cmcmcm", "..c..c.", "..c..c.", "...c..c", "..c..c.", "...c..."],
      ["...cccc", "..cccwc", "..ccccc", ".mcmcmc", "...c..c", "..c..c.", "..c..c.", "...c..c", "......c"]
    ],
    calamar: [
      ["......m", ".....mm", "....mmm", "...mmmm", "..mwmmm", "..mmmmm", ".m.m.m.", "m..m..m", ".m..m.."],
      ["......m", ".....mm", "....mmm", "...mmmm", "..mwmmm", "..mmmmm", "..m.m.m", "..m..m.", "...m..m"]
    ],
    pulpo: [
      [".....ggg", "...ggggg", "..gggggg", "..gdwggg", "..gggggg", ".ggggggg", "g.g.g.g.", "g..g..g.", ".g..g..g"],
      [".....ggg", "...ggggg", "..gggggg", "..gdwggg", "..gggggg", ".ggggggg", ".g.g.g.g", ".g..g..g", "g..g..g."]
    ],
    // Superficie de la Luna
    polilla: [
      ["k......", "kk....l", "kkk..ll", "kkkk.ll", ".kkkkll", "..kk.ll", ".kk..ll", "kk....l", "k......"],
      [".......", "..k...l", ".kkk.ll", "kkkkkll", "kkkkkll", ".kkk.ll", "..k..ll", "......l", "......."]
    ],
    escarabajo: [
      ["..d....", "...d...", "...kkkk", "..kkykk", ".kkkkkk", ".kdkdkd", ".kkkkkk", "..k.k.k", ".k..k.."],
      ["...d...", "...d...", "...kkkk", "..kkykk", ".kkkkkk", ".kdkdkd", ".kkkkkk", ".k.k.k.", "..k..k."]
    ],
    rocoso: [
      ["....kkkk", "..kkkkkk", ".kkdkkkk", ".kkykkkk", "kkkkkkkk", "kdkkkdkk", "kkkkkkkk", ".kk.kk.k", "..k..k.."],
      ["....kkkk", "..kkkkkk", ".kkdkkkk", ".kkykkkk", "kkkkkkkk", "kdkkkdkk", "kkkkkkkk", "kk.kk.kk", ".k..k..k"]
    ],
    // Cinturón de satélites
    dron: [
      ["nn.....", "nnn..ss", ".n.ssss", "...sssr", "...ssss", ".n.ssss", "nnn..ss", "nn.....", "......."],
      [".......", ".nn..ss", "nnnssss", "...sssr", "...ssss", "nnnssss", ".nn..ss", ".......", "......."]
    ],
    antena: [
      ["nnn...y", "nnn..yy", "nnnkyyy", "nnnkyry", "nnnkyyy", "nnn..yy", "nnn...y", "......k", "......w"],
      ["nnn...y", "nnn..yy", "nnnkyyy", "nnnkywy", "nnnkyyy", "nnn..yy", "nnn...y", "......k", "......r"]
    ],
    nodo: [
      ["......cc", "....cccc", "..ccdddd", ".ccdwddd", "ccdddddd", ".ccddddr", "..ccdddd", "....cccc", "......cc"],
      ["......cc", "....cccc", "..ccdddd", ".ccdrddd", "ccdddddd", ".ccddddw", "..ccdddd", "....cccc", "......cc"]
    ],
    // Cerca del Sol
    chispa: [
      ["......y", ".....yo", "....yoo", "...yoof", "..yooff", "..oooff", "...ooof", "....ooo", "......o"],
      [".......", "......y", ".....yo", "....yoo", "...yoof", "..yooff", "..oooff", "...oooo", ".....oo"]
    ],
    salamandra: [
      ["......r", ".....rr", "r..rrry", ".rrrooo", "...rooo", "...rooo", ".rrrooo", "r....rr", "......r"],
      ["......r", "r....rr", ".rrrrry", "...rooo", "...rooo", "...rooo", "...rooo", ".rr..rr", "r.....r"]
    ],
    fenix: [
      ["o.......", "oo.....y", "ooo...yy", ".oooyyyy", "..ooyfyf", "...ooyyy", "....ooyy", ".....o.y", "......o."],
      ["........", "o......y", "oo....yy", "ooooyyyy", ".oooyfyf", "...ooyyy", "....ooyy", ".....o.y", "......o."]
    ],
    // Espacio profundo
    cristal: [
      ["......c", ".....cl", "....cll", "...clll", "..cllll", "...clll", "....cll", ".....cl", "......c"],
      ["......w", ".....cl", "....cll", "...cllw", "..cllll", "...clll", "....cll", ".....cl", "......w"]
    ],
    astro: [
      ["......m", "......m", ".....mm", "mmmmmmw", ".mmmmmm", "..mmmmm", "..mm.mm", ".mm....", "m......"],
      ["......w", "......m", ".....mm", ".mmmmmw", "..mmmmm", "..mmmmm", "..mm.mm", ".m.....", "m......"]
    ],
    espectro: [
      ["....pppp", "..pppppp", ".ppppppp", ".ppwwppp", ".ppwdppp", "pppppppp", "pppppppp", "pp.ppp.p", "p...p..."],
      ["....pppp", "..pppppp", ".ppppppp", ".ppwwppp", ".ppwdppp", "pppppppp", "pppppppp", ".pp.ppp.", "..p...p."]
    ],
    // Estación Espacial Internacional (los originales)
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

  // ---------- Escenarios (uno por misión) ----------
  // Lo que cambia entre misiones: el lugar (fondo, lo que hay abajo de la nave y lo que
  // flota detrás), los enemigos y la dificultad. Van de la más fácil a la más difícil.
  // Dificultad: filas(i) = filas de la oleada i · picadas = cuántos bajan a la vez ·
  // cadencia = espera entre picadas (más alto = más tranquilo) · bala = velocidad de los
  // disparos enemigos · tiros = disparos de cada "mariposa" al picar · abanico = disparos
  // por ráfaga del jefe · premio = probabilidad de premio.
  // cielo = fondo dibujado (ver crearCielos) · balaE = colores de los disparos enemigos ·
  // jefe = jefe final: textura, tamaño, vida, ataques ("abanico", "apuntado", "lluvia",
  // "espiral"), escolta que suelta y movimiento ("vaiven" u "ocho")
  const ESCENARIOS = {
    tierra: {
      nombre: "Órbita de la Tierra",
      intro: "Escenario: órbita baja de la Tierra. Aquí te esperan las medusas espaciales: es el nivel más tranquilo.",
      intro2: "Es de noche: abajo brillan las luces de las ciudades.",
      cielo: "cielo_noche", fondo: 0xffffff, luz: 0x2a4a9a, suelo: "suelo_noche", halo: 0x2a5fd8,
      lejanas: { textura: "asteroide_fondo_blur", tinte: 0x24345a, alfa: [0.3, 0.5] },
      balaE: [0x6fffe0, 0xe8fffb],
      jefe: { nombre: "Kraken orbital", textura: "jefe_tierra", escala: 0.6, vida: 22, brillo: 0x6fffe0,
              ataques: ["abanico", "lluvia"], escolta: "abeja", mov: "vaiven" },
      enemigos: { abeja: "medusa", mariposa: "calamar", comandante: "pulpo" },
      tintes: { abeja: [0x6fffe0, 0xff5ad8], mariposa: [0xff5ad8, 0xffffff], comandante: [0x3fe08a, 0xffffff] },
      dif: { filas: (i) => (i < 2 ? ["abeja", "abeja"] : ["mariposa", "abeja"]), picadas: 1, cadencia: 1.4, rapidez: 0.75,
             bala: 190, tiros: [0.45], abanico: 3, premio: 0.1 }
    },
    luna: {
      nombre: "Superficie de la Luna",
      intro: "Escenario: sobre la superficie de la Luna, con la Tierra a lo lejos. Polillas lunares y escarabajos de roca vuelan entre los cráteres.",
      cielo: "cielo_luna", fondo: 0xffffff, luz: 0x50586e, suelo: "suelo_luna", halo: 0xc8d0e8, planetaLejano: true,
      lejanas: { textura: "asteroide_fondo_blur", tinte: 0x3a3e4a, alfa: [0.25, 0.4] },
      balaE: [0xffd84a, 0xfff6d0],
      jefe: { nombre: "Cangrejo de cráter", textura: "jefe_luna", escala: 0.6, vida: 28, brillo: 0xc8d0e8,
              ataques: ["apuntado", "abanico"], escolta: "abeja", mov: "ocho" },
      enemigos: { abeja: "polilla", mariposa: "escarabajo", comandante: "rocoso" },
      tintes: { abeja: [0xa8b0c4, 0xc8a8ff], mariposa: [0xa8b0c4, 0xffd84a], comandante: [0xa8b0c4, 0xffffff] },
      dif: { filas: (i) => (i === 0 ? ["mariposa", "abeja"] : ["mariposa", "abeja", "abeja"]), picadas: 2, cadencia: 1.2, rapidez: 0.9,
             bala: 210, tiros: [0.42], abanico: 3, premio: 0.08 }
    },
    estacion: {
      nombre: "Estación Espacial Internacional",
      intro: "Escenario: junto a la Estación Espacial Internacional. Las abejas y mariposas alienígenas atacan en formación.",
      cielo: "fondo", fondo: 0xffffff, luz: 0x8fd8ff, suelo: "tierra", halo: 0x4aa3ff,
      lejanas: { textura: "asteroide_fondo_blur", tinte: 0x7fa8d8, alfa: [0.35, 0.6] },
      balaE: [0xff6846, 0xffe0a0],
      jefe: { nombre: "Nave nodriza", textura: "nodriza", escala: 0.55, vida: 30, brillo: 0xc08cff,
              ataques: ["abanico", "apuntado"], escolta: "abeja", mov: "vaiven" },
      enemigos: { abeja: "abeja", mariposa: "mariposa", comandante: "comandante" },
      tintes: { abeja: [0xffd84a, 0x4a8cff], mariposa: [0xff4a5a, 0xffffff], comandante: [0x3fe08a, 0xa36bff] },
      dif: { filas: (i) => (i === 0 ? ["mariposa", "abeja"] : ["mariposa", "mariposa", "abeja"]), picadas: 2, cadencia: 1, rapidez: 1,
             bala: 230, tiros: [0.35, 0.5], abanico: 3, premio: 0.06 }
    },
    satelites: {
      nombre: "Cinturón de satélites",
      intro: "Escenario: el cinturón de satélites que rodea la Tierra. Los drones y las antenas enemigas son más rápidos: ¡cuidado!",
      intro2: "Sobre el polo, las auroras pintan el cielo de verde.",
      cielo: "cielo_aurora", fondo: 0xffffff, luz: 0x3fe08a, suelo: "suelo_noche", halo: 0x3fe08a,
      lejanas: { textura: "satdecor", tinte: 0xffffff, alfa: [0.35, 0.6], nitidas: true },
      balaE: [0x3fe08a, 0xe0ffe8],
      jefe: { nombre: "Satélite renegado", textura: "jefe_satelites", escala: 0.62, vida: 36, brillo: 0x6fffe0,
              ataques: ["apuntado", "lluvia", "abanico"], escolta: "mariposa", mov: "ocho" },
      enemigos: { abeja: "dron", mariposa: "antena", comandante: "nodo" },
      tintes: { abeja: [0xe6ebf5, 0xff4a5a], mariposa: [0x2a5fd8, 0xffd84a], comandante: [0x6fffe0, 0xffffff] },
      dif: { filas: (i) => (i === 0 ? ["mariposa", "abeja", "abeja"] : ["mariposa", "mariposa", "abeja"]), picadas: 3, cadencia: 0.9, rapidez: 1.12,
             bala: 250, tiros: [0.35, 0.5], abanico: 3, premio: 0.06 }
    },
    sol: {
      nombre: "Cerca del Sol",
      intro: "Escenario: muy cerca del Sol, entre llamaradas. Las chispas y salamandras de fuego disparan más rápido.",
      cielo: "cielo_sol", fondo: 0xffffff, luz: 0xff7a2a, suelo: "suelo_sol", halo: 0xff8a2a, llamas: true, estrellas: 0.35,
      lejanas: { textura: "asteroide_fondo_blur", tinte: 0x7a2a10, alfa: [0.3, 0.5] },
      balaE: [0xff3a1a, 0xfff0a0],
      jefe: { nombre: "Fénix solar", textura: "jefe_sol", escala: 0.65, vida: 42, brillo: 0xff8a2a,
              ataques: ["lluvia", "abanico", "apuntado"], escolta: "mariposa", mov: "ocho" },
      enemigos: { abeja: "chispa", mariposa: "salamandra", comandante: "fenix" },
      tintes: { abeja: [0xffd84a, 0xff8a2a], mariposa: [0xff4a5a, 0xff8a2a], comandante: [0xffd84a, 0xffffff] },
      dif: { filas: (i) => (i === 0 ? ["mariposa", "mariposa", "abeja"] : ["mariposa", "mariposa", "abeja", "abeja"]), picadas: 3, cadencia: 0.8, rapidez: 1.2,
             bala: 270, tiros: [0.3, 0.45, 0.6], abanico: 4, premio: 0.07 }
    },
    estrellas: {
      nombre: "Espacio profundo",
      intro: "Escenario: el espacio profundo, entre nebulosas y estrellas lejanas. Es el nivel más difícil: cristales y astros atacan sin parar.",
      cielo: "cielo_nebulosa", fondo: 0xffffff, luz: 0xd070ff, suelo: null, halo: 0xc08cff,
      lejanas: { textura: "luz", tinte: 0xd070ff, alfa: [0.12, 0.22], nebulosa: true },
      balaE: [0xff5ad8, 0xffe0f6],
      jefe: { nombre: "Devorador de estrellas", textura: "jefe_estrellas", escala: 0.65, vida: 50, brillo: 0xd070ff,
              ataques: ["espiral", "apuntado", "abanico"], escolta: "mariposa", mov: "ocho" },
      enemigos: { abeja: "cristal", mariposa: "astro", comandante: "espectro" },
      tintes: { abeja: [0x6fffe0, 0xc8a8ff], mariposa: [0xff5ad8, 0xffffff], comandante: [0xa36bff, 0xffffff] },
      dif: { filas: (i) => (i === 0 ? ["mariposa", "mariposa", "abeja", "abeja"] : ["mariposa", "mariposa", "mariposa", "abeja"]), picadas: 3, cadencia: 0.7, rapidez: 1.3,
             bala: 290, tiros: [0.3, 0.45, 0.6], abanico: 5, premio: 0.08 }
    }
  };

  Object.entries(ESCENARIOS).forEach(([clave, e]) => { e.clave = clave; });

  // ---------- Cielos de fondo (se dibujan una vez, en un canvas) ----------
  const rgba = (hex, a) => `rgba(${hex >> 16 & 255}, ${hex >> 8 & 255}, ${hex & 255}, ${a})`;
  function crearCielos(escena) {
    const lienzo = (clave, dibujar) => {
      const t = escena.textures.createCanvas(clave, 960, 1280);
      dibujar(t.getContext(), 960, 1280);
      t.refresh();
    };
    const degradado = (c, w, h, colores) => {
      const g = c.createLinearGradient(0, 0, 0, h);
      colores.forEach((col, i) => g.addColorStop(i / (colores.length - 1), col));
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    };
    const mancha = (c, x, y, r, col, a) => {
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0));
      c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
    };
    const estrellas = (c, w, h, cuantas, colores, max = 1.8, zona = null) => {
      for (let i = 0; i < cuantas; i++) {
        const x = zona ? zona.x() : rand(0, w), y = zona ? zona.y(x) : rand(0, h), r = rand(0.4, max);
        c.globalAlpha = rand(0.35, 1); c.fillStyle = colores[i % colores.length];
        c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
        if (r > max * 0.85) { mancha(c, x, y, r * 7, 0xffffff, 0.25); }
      }
      c.globalAlpha = 1;
    };
    // Noche sobre la Tierra: muy oscuro, muchas estrellas y la Vía Láctea en diagonal
    lienzo("cielo_noche", (c, w, h) => {
      degradado(c, w, h, ["#010208", "#040a20", "#0a1838", "#132a5a"]);
      for (let i = 0; i < 40; i++) { const x = rand(0, w); mancha(c, x, h * 0.9 - x * 0.7 + rand(-60, 60), rand(80, 160), i % 2 ? 0x8a7ad8 : 0x4a6ad8, 0.06); }
      estrellas(c, w, h, 700, ["#ffffff", "#cfe0ff", "#fff2d0"], 2);
      estrellas(c, w, h, 500, ["#ffffff", "#d8d0ff"], 1.1, { x: () => rand(0, w), y: (x) => h * 0.9 - x * 0.7 + rand(-90, 90) });
    });
    // Cielo de la Luna: negro total, sin aire; estrellas nítidas
    lienzo("cielo_luna", (c, w, h) => {
      degradado(c, w, h, ["#000000", "#030305", "#0a0a10"]);
      estrellas(c, w, h, 900, ["#ffffff", "#e8ecff", "#fff4dc"], 1.6);
    });
    // Auroras: cortinas verdes que ondulan sobre la noche polar
    lienzo("cielo_aurora", (c, w, h) => {
      degradado(c, w, h, ["#01060a", "#021418", "#04262a", "#06343a"]);
      estrellas(c, w, h, 500, ["#ffffff", "#d0fff0"], 1.6);
      c.globalCompositeOperation = "lighter";
      [[0x3fe08a, 520, 0.22], [0x6fffe0, 650, 0.14], [0xc070ff, 380, 0.1]].forEach(([col, base, a], capa) => {
        for (let x = 0; x < w; x += 3) {
          const y = base + Math.sin(x * 0.006 + capa * 2) * 120 + Math.sin(x * 0.017 + capa) * 40;
          const alto = 220 + Math.sin(x * 0.011 + capa * 3) * 110;
          const g = c.createLinearGradient(0, y - alto, 0, y);
          g.addColorStop(0, rgba(col, 0)); g.addColorStop(0.75, rgba(col, a)); g.addColorStop(1, rgba(col, 0));
          c.fillStyle = g; c.fillRect(x, y - alto, 3, alto);
        }
      });
      c.globalCompositeOperation = "source-over";
    });
    // Cerca del Sol: cielo rojo y naranja que se calienta hacia abajo
    lienzo("cielo_sol", (c, w, h) => {
      degradado(c, w, h, ["#140200", "#3a0802", "#7a1a04", "#c8460c", "#ff8a2a"]);
      for (let i = 0; i < 18; i++) mancha(c, rand(0, w), rand(h * 0.3, h), rand(120, 280), i % 2 ? 0xff6a1a : 0xffc04a, 0.12);
      estrellas(c, w, h * 0.45, 140, ["#ffd8b0", "#ffffff"], 1.2);
    });
    // Espacio profundo: nebulosa morada y rosa con una galaxia en espiral
    lienzo("cielo_nebulosa", (c, w, h) => {
      degradado(c, w, h, ["#05010c", "#0c0320", "#14052c"]);
      for (let i = 0; i < 30; i++) mancha(c, rand(0, w), rand(0, h), rand(120, 320), [0xff5ad8, 0x7a3ad8, 0x2a5fd8, 0xd070ff][i % 4], 0.12);
      estrellas(c, w, h, 800, ["#ffffff", "#f0d8ff", "#d0e8ff"], 1.8);
      // Galaxia: dos brazos de puntitos alrededor de un centro brillante
      const gx = w * 0.7, gy = h * 0.26;
      mancha(c, gx, gy, 140, 0xfff0ff, 0.35);
      for (let brazo = 0; brazo < 2; brazo++) {
        for (let k = 0; k < 500; k++) {
          const t = (k / 500) * Math.PI * 3, r = 10 + t * 32 + rand(-10, 10), a = t + brazo * Math.PI;
          c.globalAlpha = rand(0.2, 0.8) * (1 - k / 600); c.fillStyle = k % 3 ? "#e8d0ff" : "#ffffff";
          c.beginPath(); c.arc(gx + Math.cos(a) * r, gy + Math.sin(a) * r * 0.42, rand(0.6, 1.8), 0, Math.PI * 2); c.fill();
        }
      }
      c.globalAlpha = 1;
    });
  }

  // ---------- Jefes finales (dibujados con figuras) ----------
  function crearJefes(escena) {
    const dibujo = (clave, fn) => { const g = escena.add.graphics(); fn(g); g.generateTexture(clave, 320, 170); g.destroy(); };
    // Kraken orbital: medusa gigante con tentáculos
    dibujo("jefe_tierra", (g) => {
      for (let i = 0; i < 6; i++) {
        for (let k = 0; k < 7; k++) {
          const x = 72 + i * 35 + Math.sin(k * 0.9 + i) * 9, y = 108 + k * 9;
          g.fillStyle(k % 2 ? 0x2ad0c0 : 0x6fffe0, 1).fillCircle(x, y, 10 - k);
        }
      }
      g.fillStyle(0x1aa0a0, 1).fillEllipse(160, 72, 240, 124);
      g.fillStyle(0x2ad0c0, 1).fillEllipse(160, 66, 220, 108);
      g.fillStyle(0x6fffe0, 1).fillEllipse(160, 58, 190, 84);
      g.fillStyle(0xffffff, 0.45).fillEllipse(122, 36, 56, 20);
      [[100, 82], [160, 96], [220, 82], [130, 50], [195, 48]].forEach(([x, y]) => g.fillStyle(0xff5ad8, 1).fillCircle(x, y, 8));
      [[134, 72], [186, 72]].forEach(([x, y]) => { g.fillStyle(0xffffff, 1).fillCircle(x, y, 15); g.fillStyle(0x050816, 1).fillCircle(x + 2, y + 3, 7); });
    });
    // Cangrejo de cráter: caparazón de roca con tenazas
    dibujo("jefe_luna", (g) => {
      g.lineStyle(7, 0x6c7186, 1);
      [[100, 120, 70, 160], [125, 130, 105, 166], [220, 120, 250, 160], [195, 130, 215, 166]].forEach(([a, b, c, d]) => g.lineBetween(a, b, c, d));
      g.lineStyle(6, 0x8a90a6, 1).lineBetween(135, 52, 128, 20).lineBetween(185, 52, 192, 20);
      [[128, 16], [192, 16]].forEach(([x, y]) => { g.fillStyle(0xffd84a, 1).fillCircle(x, y, 10); g.fillStyle(0x050816, 1).fillCircle(x, y + 1, 4); });
      [-1, 1].forEach((lado) => {
        const cx = 160 + lado * 120;
        g.fillStyle(0x8a90a6, 1).fillRect(lado < 0 ? cx + 10 : cx - 50, 80, 40, 16);
        g.fillStyle(0x9aa0b4, 1).fillTriangle(cx - lado * 10, 50, cx + lado * 38, 72, cx - lado * 26, 88);
        g.fillStyle(0x9aa0b4, 1).fillTriangle(cx - lado * 10, 126, cx + lado * 38, 98, cx - lado * 26, 86);
        g.fillStyle(0xffd84a, 1).fillCircle(cx - lado * 8, 88, 5);
      });
      g.fillStyle(0x6c7186, 1).fillEllipse(160, 92, 210, 116);
      g.fillStyle(0xa8b0c4, 1).fillEllipse(160, 84, 186, 92);
      [[120, 80, 26], [190, 70, 20], [165, 105, 30], [205, 100, 14], [135, 108, 12]].forEach(([x, y, r]) => {
        g.fillStyle(0x7a8098, 1).fillEllipse(x, y, r * 1.6, r);
        g.fillStyle(0xc8ccd8, 1).fillEllipse(x - 2, y - r * 0.35, r * 1.2, r * 0.3);
      });
    });
    // Satélite renegado: paneles enormes y un lente rojo
    dibujo("jefe_satelites", (g) => {
      [0, 210].forEach((x) => {
        g.fillStyle(0x2a5fd8, 1).fillRect(x, 48, 110, 64);
        g.lineStyle(2, 0x9fd0ff, 1);
        for (let k = 1; k < 6; k++) g.lineBetween(x + k * 18, 48, x + k * 18, 112);
        g.lineBetween(x, 80, x + 110, 80);
        g.lineStyle(3, 0xe6ebf5, 1).strokeRect(x, 48, 110, 64);
      });
      g.fillStyle(0x8a94b8, 1).fillRect(108, 74, 104, 12);
      const hex = (r) => Array.from({ length: 6 }, (_, k) => ({ x: 160 + Math.cos(k * Math.PI / 3) * r, y: 84 + Math.sin(k * Math.PI / 3) * r }));
      g.fillStyle(0xe8a020, 1).fillPoints(hex(52), true);
      g.fillStyle(0xffc53d, 1).fillPoints(hex(42), true);
      g.fillStyle(0xe6ebf5, 1).fillEllipse(160, 26, 74, 24);
      g.lineStyle(3, 0xffffff, 1).lineBetween(160, 22, 160, 4);
      g.fillStyle(0xff4a5a, 1).fillCircle(160, 4, 4);
      g.fillStyle(0x050816, 1).fillCircle(160, 96, 20);
      g.fillStyle(0xff4a5a, 1).fillCircle(160, 96, 12);
      g.fillStyle(0xffffff, 0.8).fillCircle(155, 91, 4);
    });
    // Fénix solar: alas de fuego abiertas
    dibujo("jefe_sol", (g) => {
      [-1, 1].forEach((lado) => {
        const p = (x) => 160 + lado * x;
        g.fillStyle(0xff4a1a, 1).fillTriangle(p(10), 70, p(158), 6, p(120), 128);
        g.fillStyle(0xff8a2a, 1).fillTriangle(p(10), 78, p(138), 28, p(100), 118);
        g.fillStyle(0xffc04a, 1).fillTriangle(p(10), 84, p(110), 52, p(76), 110);
        g.fillStyle(0xff4a1a, 1).fillTriangle(p(6), 128, p(40), 130, p(36), 168);
      });
      g.fillStyle(0xff6a1a, 1).fillTriangle(146, 128, 174, 128, 160, 168);
      g.fillStyle(0xffa53a, 1).fillEllipse(160, 88, 60, 104);
      g.fillStyle(0xffe08a, 1).fillEllipse(160, 98, 34, 60);
      g.fillStyle(0xff4a1a, 1).fillTriangle(150, 26, 160, 0, 170, 26);
      g.fillStyle(0xffc04a, 1).fillCircle(160, 40, 22);
      g.fillStyle(0xff3a1a, 1).fillCircle(151, 37, 4).fillCircle(169, 37, 4);
      g.fillStyle(0xfff0a0, 1).fillTriangle(153, 48, 167, 48, 160, 62);
    });
    // Devorador de estrellas: disco oscuro con púas y un ojo
    dibujo("jefe_estrellas", (g) => {
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * Math.PI * 2, b = a + 0.16, c2 = a - 0.16;
        g.fillStyle(k % 2 ? 0x7a3ad8 : 0xd070ff, 1).fillTriangle(
          160 + Math.cos(b) * 58, 85 + Math.sin(b) * 58 * 0.95, 160 + Math.cos(c2) * 58, 85 + Math.sin(c2) * 58 * 0.95,
          160 + Math.cos(a) * 84, 85 + Math.sin(a) * 82);
      }
      g.fillStyle(0x3a1a6a, 1).fillCircle(160, 85, 62);
      g.lineStyle(6, 0xd070ff, 1).strokeCircle(160, 85, 54);
      g.fillStyle(0x14052c, 1).fillCircle(160, 85, 42);
      g.fillStyle(0xffffff, 1).fillEllipse(160, 85, 60, 36);
      g.fillStyle(0xff5ad8, 1).fillCircle(160, 85, 15);
      g.fillStyle(0x050816, 1).fillCircle(160, 85, 7);
      g.fillStyle(0xffffff, 0.9).fillCircle(155, 80, 3);
    });
  }

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
      combo: 0, comboMax: 0, fallos: 0, derribados: 0, esc: ESCENARIOS.estacion
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

    // ---------- Escenario de la misión ----------
    // Pone el fondo, lo que hay abajo (Tierra, Luna, Sol o nada) y lo que flota detrás
    function aplicarEscenario() {
      const e = s.esc;
      sc.fondoImg.setTexture(e.cielo).setTint(e.fondo); sc.luzFondo.setTint(e.luz);
      [sc.estrellas1, sc.estrellas2].forEach((t) => t.setAlpha(e.estrellas ?? 1));
      maquetarFondo();
      sc.tierra.setVisible(!!e.suelo); if (e.suelo) sc.tierra.setTexture(e.suelo);
      sc.halo.setTint(e.halo).setVisible(!!e.suelo || e.lejanas.nebulosa);
      sc.planetaLejano.setVisible(!!e.planetaLejano); sc.brilloLejano.setVisible(!!e.planetaLejano);
      sc.llamas.emitting = !!e.llamas;
      sc.lejanas.forEach((a) => {
        a.setTexture(e.lejanas.textura).setTint(e.lejanas.tinte).setAlpha(rand(...e.lejanas.alfa));
        a.setBlendMode(e.lejanas.nebulosa ? "ADD" : "NORMAL");
        a.setScale(e.lejanas.nebulosa ? rand(2.5, 4) : e.lejanas.nitidas ? rand(0.6, 1) : rand(0.8, 1.7));
      });
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
      const jefe = !s.enJefe ? "" : s.jefeDerrotado ? "¡Derrotaste a " + s.esc.jefe.nombre + "!"
        : "¡Jefe final: " + s.esc.jefe.nombre + "! Derrótalo para ganar puntos extra";
      return { vidas: s.vidas, puntos: s.puntos, indice: s.indice, total: s.preguntas.length, texto: p ? p.texto : jefe, jefe: s.enJefe };
    };
    const quitar = (arr, o) => { const i = arr.indexOf(o); if (i >= 0) arr.splice(i, 1); };

    // ---------- Balas ----------
    function crearBala(x, y) {
      const b = sc.add.image(x, y, "bala").setBlendMode("ADD").setDepth(7).setScale(0.9);
      const halo = sc.add.image(x, y, "brillo").setBlendMode("ADD").setDepth(7).setTint(0x6fffff).setScale(0.55).setAlpha(0.8);
      s.balas.push({ x, y, img: b, halo });
    }
    function quitarBala(b) { b.img.destroy(); b.halo.destroy(); quitar(s.balas, b); }
    function dispararEnemigo(x, y, vx = limitar((s.nave.x - x) * 0.5, -110, 110), vy = s.esc.dif.bala) {
      const img = sc.add.image(x, y, "balaE_" + s.esc.clave).setBlendMode("ADD").setDepth(7);
      img.rotation = Math.atan2(vy, vx) - Math.PI / 2;
      s.disparos.push({ x, y, vx, vy, img });
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
      const img = sc.add.image(ruta[0].x, ruta[0].y, s.esc.enemigos[tipo] + "1").setScale(ESCALA[tipo]).setDepth(6).setVisible(false);
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
      const tintes = s.esc.tintes[a.tipo];
      chispas(a.x, a.y, grande ? [0xd8f34a, 0xffffff] : tintes, grande ? 40 : 18, grande ? 260 : 200);
      destello(a.x, a.y, grande ? COLOR.ok : tintes[0], grande ? 1.6 : 0.8);
    }

    function derribar(a) {
      a.muerto = true; s.derribados += 1;
      explotar(a);
      ruido(0.18, 0.04, 1000); tono(400, 120, 0.12, "square", 0.025);
      sumarCombo();
      if (Math.random() < s.esc.dif.premio) crearPremio(a.x, a.y, ["doble", "escudo", "reparar"][Math.floor(Math.random() * 3)]);
    }

    // Un escolta sale de la formación, hace un rizo y se lanza hacia la nave
    function iniciarPicada(a) {
      const dir = a.x < W / 2 ? -1 : 1;
      const objetivo = limitar(s.nave.x + rand(-40, 40), 30, W - 30);
      a.ruta = [{ x: a.x, y: a.y }, { x: a.x + dir * 90, y: a.y - 70 }, { x: objetivo - dir * 60, y: H * 0.5 }, { x: objetivo + dir * 80, y: H + 50 }];
      a.estado = "pica"; a.t = 0; a.dur = Math.max(1.9, 2.6 - s.indice * 0.1) / s.esc.dif.rapidez;
      a.tiros = a.tipo === "mariposa" ? [...s.esc.dif.tiros] : [0.42];
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
      const filas = s.esc.dif.filas(s.indice);
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

    // ---------- Jefe final (al terminar todas las preguntas) ----------
    // Una nave grande, distinta en cada escenario. Si el niño la derrota gana puntos
    // extra (los da el servidor con cb.alJefe, una sola vez por misión).
    function crearJefe() {
      const def = s.esc.jefe;
      const img = sc.add.image(W / 2, -110, def.textura).setScale(def.escala).setDepth(6);
      const luz = sc.add.image(W / 2, -110, "luz").setBlendMode("ADD").setTint(def.brillo)
        .setDisplaySize(img.displayWidth * 1.5, img.displayHeight * 2).setAlpha(0.35).setDepth(5);
      const barra = sc.add.graphics().setDepth(11);
      const nombre = sc.add.text(W / 2, 12, def.nombre.toUpperCase(), {
        fontFamily: "IBM Plex Mono, monospace", fontSize: "12px", fontStyle: "600", color: "#ffffff", stroke: "#050816", strokeThickness: 3, resolution: Z
      }).setOrigin(0.5, 0).setDepth(11);
      s.jefe = { img, luz, barra, nombre, def, x: W / 2, y: -110, hp: def.vida, max: def.vida, t: 0, sigTiro: 2.2, sigEscolta: 4, turno: 0, furia: false };
      s.enJefe = true; s.fase = "jefe";
      limpiarAliens(); limpiarDisparos();
      mensaje("¡JEFE FINAL!", W / 2, H / 2 - 20, "#ff6846", 32);
      sc.time.delayedCall(700, () => mensaje(def.nombre, W / 2, H / 2 + 20, "#ffffff", 24));
      sc.cameras.main.shake(600, 0.008);
      tono(90, 60, 0.9, "sawtooth", 0.06); setTimeout(() => tono(70, 45, 0.9, "sawtooth", 0.06), 400);
      cb.alHud(hud());
    }
    function destruirJefe(j) { j.img.destroy(); j.luz.destroy(); j.barra.destroy(); j.nombre.destroy(); }
    function dibujarBarraJefe(j) {
      j.barra.clear();
      const w = Math.min(320, W * 0.6), x = W / 2 - w / 2, y = 32, k = Math.max(0, j.hp / j.max);
      j.barra.fillStyle(0x050816, 0.85).fillRect(x - 3, y - 3, w + 6, 14);
      j.barra.fillStyle(j.furia ? 0xff3a1a : 0xff6846, 1).fillRect(x, y, w * k, 8);
      j.barra.fillStyle(0xffffff, 0.35).fillRect(x, y, w * k, 3);
      j.nombre.setPosition(W / 2, 12);
    }
    // Ataques: cada ráfaga usa el siguiente de la lista del escenario
    function ataqueJefe(j) {
      const tipo = j.def.ataques[j.turno++ % j.def.ataques.length];
      const x = j.x, y = j.y + j.img.displayHeight * 0.35, v = s.esc.dif.bala;
      if (tipo === "abanico") {
        const n = s.esc.dif.abanico + (j.furia ? 2 : 0);
        for (let k = 0; k < n; k++) dispararEnemigo(x, y, (k - (n - 1) / 2) * (220 / Math.max(1, n - 1)), v);
      } else if (tipo === "apuntado") {
        // Disparos seguidos hacia donde está la nave
        [0, 160, 320].concat(j.furia ? [480] : []).forEach((ms) => sc.time.delayedCall(ms, () => {
          if (s.jefe !== j) return;
          const yy = j.y + j.img.displayHeight * 0.35, t = Math.max(0.3, (s.nave.y - yy) / (v * 1.1));
          dispararEnemigo(j.x, yy, limitar((s.nave.x - j.x) / t, -260, 260), v * 1.1);
        }));
      } else if (tipo === "lluvia") {
        // Disparos que caen desde arriba en lugares al azar
        for (let k = 0; k < (j.furia ? 9 : 6); k++) {
          sc.time.delayedCall(k * 110, () => { if (s.jefe === j) dispararEnemigo(rand(30, W - 30), -10, rand(-20, 20), v * 0.75); });
        }
      } else if (tipo === "espiral") {
        // Anillo que gira: hay que buscar el hueco
        const n = j.furia ? 14 : 10;
        for (let k = 0; k < n; k++) {
          const a = j.t * 1.7 + (k * Math.PI * 2) / n;
          dispararEnemigo(x, j.y, Math.cos(a) * v * 0.65, Math.sin(a) * v * 0.65);
        }
      }
      tono(300, 150, 0.12, "square", 0.02);
    }
    function matarJefe() {
      const j = s.jefe; s.jefe = null; s.jefeDerrotado = true;
      // Explosión en cadena
      for (let k = 0; k < 8; k++) {
        sc.time.delayedCall(k * 120, () => {
          const ex = j.x + rand(-j.img.displayWidth / 2, j.img.displayWidth / 2), ey = j.y + rand(-j.img.displayHeight / 2, j.img.displayHeight / 2);
          chispas(ex, ey, [j.def.brillo, 0xffffff, 0xffb347], 30, 260); destello(ex, ey, j.def.brillo, 1.4);
          ruido(0.25, 0.05, 1200);
        });
      }
      sc.time.delayedCall(1000, () => { chispas(j.x, j.y, [j.def.brillo, 0xffffff], 90, 360); destello(j.x, j.y, 0xffffff, 3); });
      sc.cameras.main.shake(900, 0.016); sc.cameras.main.flash(300, 255, 230, 160);
      ruido(0.9, 0.09, 1200); tono(160, 40, 0.8, "sawtooth", 0.07);
      sc.tweens.add({ targets: [j.img, j.luz], alpha: 0, duration: 1100, onComplete: () => destruirJefe(j) });
      j.barra.clear(); j.nombre.setVisible(false);
      limpiarDisparos(); s.aliens.forEach((a) => explotar(a)); limpiarAliens();
      mensaje(`¡${j.def.nombre} derrotado!`, W / 2, H / 2 - 30, "#d8f34a", 26);
      s.inmune = 99;          // ya nada lo puede dañar
      s.finJefe = 3.4;        // tiempo para festejar antes del resultado
      s.bonoListo = false;
      // Puntos extra: los decide el servidor (o la bandeja sin conexión)
      Promise.resolve(cb.alJefe()).then((r) => {
        const p = Number((r && r.puntos_ganados) || 0);
        s.bonoJefe = p; s.puntos += p;
        mensaje(p > 0 ? `+${p} PUNTOS EXTRA` : "¡Jefe vencido otra vez!", W / 2, H / 2 + 20, "#6fd0ff", p > 0 ? 30 : 20);
        if (p > 0) { tono(520, 1040, 0.3, "triangle", 0.06); setTimeout(() => tono(780, 1560, 0.4, "triangle", 0.05), 150); }
        cb.alHud(hud());
      }).catch(() => {}).finally(() => { s.bonoListo = true; });
    }
    function actualizarJefe(dt) {
      const j = s.jefe;
      j.t += dt;
      const vel = j.furia ? 1.45 : 1;
      j.y += (150 - j.y) * Math.min(1, dt * 1.2);
      const amplitud = Math.max(110, W / 2 - j.img.displayWidth / 2 - 10);
      j.x = W / 2 + Math.sin(j.t * 0.7 * vel) * amplitud;
      if (j.def.mov === "ocho") j.y += Math.cos(j.t * 1.4 * vel) * 60 * dt;   // dibuja un ocho
      j.img.setPosition(j.x, j.y);
      j.luz.setPosition(j.x, j.y).setAlpha((j.furia ? 0.45 : 0.3) + Math.sin(j.t * (j.furia ? 9 : 4)) * 0.1);
      // Impactos de la nave
      const ancho = j.img.displayWidth * 0.42, alto = j.img.displayHeight * 0.4;
      const bala = s.balas.find((b) => Math.abs(b.x - j.x) < ancho && Math.abs(b.y - j.y) < alto);
      if (bala) {
        quitarBala(bala); j.hp -= 1; j.img.setTint(0xff9a7a); sc.time.delayedCall(70, () => j.img.active && j.img.clearTint());
        chispas(bala.x, bala.y, j.def.brillo, 5, 120); tono(240, 120, 0.05, "square", 0.025);
        if (j.hp <= 0) { matarJefe(); return; }
        if (!j.furia && j.hp <= j.max / 2) {
          j.furia = true;
          mensaje("¡FURIA!", j.x, j.y + 60, "#ff3a1a", 26);
          sc.cameras.main.shake(300, 0.01); tono(120, 60, 0.5, "sawtooth", 0.06);
        }
      }
      if (j.y > 100) {
        j.sigTiro -= dt;
        if (j.sigTiro <= 0) { ataqueJefe(j); j.sigTiro = rand(1.3, 1.9) * s.esc.dif.cadencia * (j.furia ? 0.7 : 1); }
        // Suelta escoltas que se lanzan contra la nave
        j.sigEscolta -= dt;
        if (j.sigEscolta <= 0) {
          [-40, 40].forEach((dx) => iniciarPicada(crearAlien(j.def.escolta, null, [{ x: j.x + dx, y: j.y + 20 }], 0)));
          j.sigEscolta = j.furia ? 3.5 : 5;
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
        cb.alPerder({ jefe: s.enJefe });
      }
    }
    function terminar() {
      s.modo = "fin"; pararMusica();
      cb.alTerminar({ puntos: s.puntos, ultima: s.ultima, vidas: s.vidas, fallos: s.fallos, racha: s.comboMax, aliens: s.derribados,
                      jefe: { nombre: s.esc.jefe.nombre, derrotado: s.jefeDerrotado, bono: s.bonoJefe } });
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
        if (a.cuadro !== cuadro) { a.cuadro = cuadro; a.img.setTexture(s.esc.enemigos[a.tipo] + cuadro); }
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
          const max = s.esc.dif.picadas + Math.min(2, Math.floor(s.indice / 2)) + (W > 800 ? 1 : 0);
          if (libres.length && picando < max) iniciarPicada(libres[Math.floor(Math.random() * libres.length)]);
          s.sigPicada = Math.max(0.6, rand(1.1, 1.9) - s.indice * 0.15) * s.esc.dif.cadencia;
        } else if (s.aliens.some((a) => a.opcion && a.estado === "formado")) {
          const tipo = s.indice >= 1 && Math.random() < 0.5 ? "mariposa" : "abeja";
          iniciarPicada(crearAlien(tipo, null, [{ x: rand(60, W - 60), y: -30 }], 0));
          s.sigPicada = Math.max(1.6, rand(2.6, 3.6) - s.indice * 0.2) * s.esc.dif.cadencia;
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
      if (s.finJefe > 0) {
        s.finJefe -= dt;
        if (s.finJefe <= 0) { if (s.bonoListo) { terminar(); return; } s.finJefe = 0.2; }
      }
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
        } else if (d.y > H + 20 || d.y < -40 || d.x < -20 || d.x > W + 20) { d.img.destroy(); quitar(s.disparos, d); }
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
            if (s.indice >= s.preguntas.length) { crearJefe(); return; }
          }
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
      maquetarFondo();
      sc.luzFondo.setPosition(W * 0.62, H * 0.25);
      [sc.estrellas1, sc.estrellas2].forEach((e) => e.setPosition(W / 2, H / 2).setSize(W, H));
      const alto = W * 360 / 1024;
      // El borde del planeta (a 40% de la imagen) siempre asoma 85 px sobre el fondo
      sc.tierra.setDisplaySize(W, alto).setPosition(W / 2, H - 85 + alto * 0.1);
      sc.halo.setPosition(W / 2, H + 12).setDisplaySize(W * 1.4, 240);
      sc.planetaLejano.setPosition(W * 0.82, H * 0.17).setDisplaySize(64, 64);
      sc.brilloLejano.setPosition(W * 0.82, H * 0.17).setDisplaySize(140, 140);
      sc.llamas.setPosition(W / 2, H - 70);
      s.nave.y = H - 84;
      s.nave.x = s.objetivoX = limitar(s.nave.x * W / anchoAntes, 26, W - 26);
      s.aliens.forEach((a) => { if (a.lugar) a.lugar.x *= W / anchoAntes; });
    }
    // El cielo cubre toda la arena sin deformarse
    function maquetarFondo() {
      const f = sc.fondoImg.texture.getSourceImage();
      sc.fondoImg.setPosition(W / 2, H / 2).setScale(Math.max(W / f.width, H / f.height));
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
        // Disparos enemigos con los colores de cada escenario
        Object.values(ESCENARIOS).forEach((esc) => {
          const b = this.add.graphics();
          b.fillStyle(esc.balaE[0], 1).fillRoundedRect(0, 0, 8, 18, 4); b.fillStyle(esc.balaE[1], 1).fillRoundedRect(2, 3, 4, 12, 2);
          b.generateTexture("balaE_" + esc.clave, 8, 18); b.destroy();
        });
        crearCielos(this);
        crearJefes(this);
        const n = this.add.graphics();
        n.fillStyle(0x6fd0ff, 0.9).fillEllipse(160, 48, 110, 70);
        n.fillStyle(0xffffff, 0.6).fillEllipse(140, 36, 30, 16);
        n.fillStyle(0x5a6488, 1).fillEllipse(160, 80, 310, 70);
        n.fillStyle(0x8a94b8, 1).fillEllipse(160, 72, 290, 40);
        n.fillStyle(0x3a2a6a, 1).fillEllipse(160, 102, 200, 36);
        [-120, -80, -40, 0, 40, 80, 120].forEach((dx, i) => n.fillStyle(i % 2 ? 0xd8f34a : 0xff6846, 1).fillCircle(160 + dx, 82, 7));
        n.generateTexture("nodriza", 320, 140); n.destroy();

        // Suelos de los escenarios, con la misma forma que tierra.png (el borde asoma al 40%)
        const suelo = (clave, capas, manchas) => {
          const t = this.add.graphics(), R = 1600, cx = 512, cy = 144 + R;
          capas.forEach(([col, dr]) => t.fillStyle(col, 1).fillCircle(cx, cy, R - dr));
          manchas.forEach(([col, n2, rMin, rMax]) => {
            for (let k = 0; k < n2; k++) {
              const x = rand(20, 1004), r = rand(rMin, rMax), top = cy - Math.sqrt(R * R - (x - cx) ** 2);
              t.fillStyle(col, 1).fillEllipse(x, rand(top + r + 6, 350), r * 2.4, r);
            }
          });
          t.generateTexture(clave, 1024, 360); t.destroy();
        };
        suelo("suelo_luna", [[0xdfe4f0, 0], [0x9aa0b4, 5]], [[0x7a8098, 26, 8, 30], [0xb4bacb, 14, 4, 12]]);
        // La Tierra de noche: lado oscuro con luces de ciudades
        suelo("suelo_noche", [[0x6fb4ff, 0], [0x1a3a7a, 4], [0x0c1e44, 10]], [[0x163060, 18, 20, 50], [0xffd84a, 140, 0.8, 2.2], [0xffb347, 70, 0.8, 1.6], [0xfff0c0, 40, 0.6, 1.4]]);
        suelo("suelo_sol", [[0xffe08a, 0], [0xffc04a, 6], [0xffa53a, 30], [0xff8a2a, 70], [0xff6a1a, 130]], [[0xe85a10, 10, 6, 18], [0xfff0a0, 8, 4, 10]]);
        // Satélite de adorno (escenario del cinturón de satélites)
        const sd = this.add.graphics();
        sd.fillStyle(0x2a5fd8, 1).fillRect(0, 14, 22, 16).fillRect(42, 14, 22, 16);
        sd.fillStyle(0x8a94b8, 1).fillRect(22, 20, 20, 4);
        sd.fillStyle(0xffc53d, 1).fillRoundedRect(24, 8, 16, 28, 3);
        sd.lineStyle(2, 0xffffff, 1).lineBetween(32, 8, 32, 0);
        sd.generateTexture("satdecor", 64, 40); sd.destroy();
        // Tierra vista completa, a lo lejos (escenario de la Luna)
        const pl = this.add.graphics();
        pl.fillStyle(0x1f6fd1, 1).fillCircle(64, 64, 62).fillStyle(0x2f8ff0, 1).fillCircle(56, 56, 50);
        pl.fillStyle(0x3fbf6a, 1);
        [[40, 40, 18, 12], [74, 30, 14, 9], [80, 70, 20, 16], [44, 84, 12, 10]].forEach(([x, y, w, h]) => pl.fillEllipse(x, y, w * 2, h * 2));
        pl.fillStyle(0xffffff, 0.75);
        [[30, 62, 22, 4], [70, 50, 26, 4], [58, 96, 30, 5]].forEach(([x, y, w, h]) => pl.fillEllipse(x, y, w * 2, h * 2));
        for (let k = 0; k < 8; k++) pl.fillStyle(0x050816, 0.07).fillCircle(70 + k * 3, 70 + k * 3, 62 - k * 4);
        pl.generateTexture("planeta", 128, 128); pl.destroy();

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
        this.brilloLejano = this.add.image(0, 0, "luz").setBlendMode("ADD").setTint(0x4aa3ff).setAlpha(0.5).setDepth(2);
        this.planetaLejano = this.add.image(0, 0, "planeta").setDepth(2);
        // Llamaradas que suben desde el Sol (escenario del Sol)
        this.llamas = this.add.particles(0, 0, "fuego", {
          x: { min: -700, max: 700 }, speedY: { min: -120, max: -40 }, speedX: { min: -15, max: 15 },
          lifespan: { min: 500, max: 1100 }, scale: { start: 0.9, end: 0 }, alpha: { start: 0.8, end: 0 },
          blendMode: "ADD", frequency: 35, tint: [0xffd27a, 0xff8a3a, 0xff5a2a], emitting: false
        }).setDepth(4);

        // Nave + estela de motor + aura de escudo
        this.estela = this.add.particles(0, 0, "fuego", {
          speedY: { min: 90, max: 200 }, speedX: { min: -14, max: 14 }, lifespan: { min: 180, max: 340 },
          scale: { start: 0.65, end: 0 }, alpha: { start: 0.95, end: 0 }, blendMode: "ADD", frequency: 18,
          tint: [0xffd27a, 0xff8a3a, 0xff5a2a]
        }).setDepth(7);
        this.nave = this.add.image(s.nave.x, s.nave.y, "nave").setDisplaySize(52, 69).setDepth(8);
        this.estela.startFollow(this.nave, 0, 32);
        this.aura = this.add.image(s.nave.x, s.nave.y, "luz").setBlendMode("ADD").setTint(0x6fd0ff).setDisplaySize(110, 110).setDepth(8).setVisible(false);

        aplicarEscenario();
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
      cargar(preguntas, indice = 0, escenario = "estacion") {
        s.esc = ESCENARIOS[escenario] || ESCENARIOS.estacion;
        cuandoListo(() => { reiniciarObjetos(); aplicarEscenario(); ajustar(); });
        Object.assign(s, { preguntas, indice, vidas: 3, puntos: 0, modo: "espera", inmune: 0, doble: 0, jefeDerrotado: false,
                           hechaOla: false, entreOlas: 0, ultima: null, combo: 0, comboMax: 0, fallos: 0, derribados: 0,
                           fase: "ataque", esperaRespuestas: 0, enJefe: false, finJefe: 0, bonoJefe: 0, bonoListo: true });
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
          // Si perdió contra el jefe final, el jefe vuelve con toda su vida
          if (s.enJefe) { s.entreOlas = 0; crearJefe(); }
          cb.alHud(hud());
        });
        iniciarMusica();
      },
      // Termina la misión sin pelear (o sin volver a pelear) contra el jefe final
      rendirse() { cuandoListo(() => { reiniciarObjetos(); terminar(); }); },
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

  window.Nave = { crear, ESCENARIOS };
})();
