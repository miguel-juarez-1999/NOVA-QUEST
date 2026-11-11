// =====================================================================
// NovaQuest · API pública en Supabase (Edge Function "novaquest")
//
// Es la misma API que api/index.php (mismas rutas ?r=..., mismos datos y
// mismos códigos de error), para que la PWA publicada en GitHub Pages
// funcione sin PHP. En la computadora (localhost) se sigue usando el PHP.
//
//   GET  r=misiones | r=mision&codigo= | r=ranking&codigo_grupo= | r=linea_tiempo | r=push_clave
//   POST r=registro | r=responder | r=jefe | r=etapa_progreso | r=reiniciar_tiempo
//   GET  r=progreso
//   POST r=push_suscribir | r=push_baja | r=push_prueba                (línea del tiempo)
//   POST r=juego_avisos_estado | _suscribir | _baja | _prueba          (videojuego)
//
// La base es la de supabase/migrations (PostgreSQL). La conexión es el secreto
// NQ_DB_URL (o SUPABASE_DB_URL); las claves VAPID son secretos del proyecto.
// =====================================================================
import postgres from "npm:postgres@3.4.5";
import webpush from "npm:web-push@3.6.7";

// NQ_DB_URL (secreto propio) gana a SUPABASE_DB_URL, que Supabase llena solo
// pero se queda con la contraseña vieja si la de la base se cambia después.
const DB_URL = Deno.env.get("NQ_DB_URL") || Deno.env.get("SUPABASE_DB_URL")!;
// PostgreSQL normaliza las contraseñas con acentos o símbolos raros (SASLprep);
// la librería no, así que se le pasa ya normalizada.
const sql = postgres(DB_URL, {
  prepare: false,
  max: 3,
  pass: decodeURIComponent(new URL(DB_URL).password).normalize("NFKC"),
});

// Puntos extra por derrotar al jefe final de cada misión (igual que en PHP)
const JEFE_PUNTOS: Record<string, number> = { "NQ-01": 20, "NQ-02": 25, "NQ-03": 30, "NQ-04": 35, "NQ-05": 40, "NQ-06": 50 };
// Segundos mínimos entre dos avisos de ranking al mismo navegador
const ESPERA_RANKING = 120;

// ---------------------------------------------------------------------
// Respuestas y CORS
// ---------------------------------------------------------------------
const ORIGENES = new Set(["https://miguel-juarez-1999.github.io"]);

function cors(req: Request): Record<string, string> {
  const origen = req.headers.get("origin") || "";
  const local = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origen);
  return {
    "Access-Control-Allow-Origin": ORIGENES.has(origen) || local ? origen : "https://miguel-juarez-1999.github.io",
    "Access-Control-Allow-Headers": "content-type, x-token, authorization, apikey, x-client-info",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
  };
}

// Igual que salida() en PHP: corta la petición con un código y un JSON
class Salida {
  constructor(public codigo: number, public datos: unknown) {}
}
const salida = (codigo: number, datos: unknown): never => {
  throw new Salida(codigo, datos);
};

async function cuerpo(req: Request): Promise<Record<string, any>> {
  try {
    const j = await req.json();
    return j && typeof j === "object" && !Array.isArray(j) ? j : {};
  } catch {
    return {};
  }
}

async function sha256(texto: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexAlAzar(bytes: number): string {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

type Usuario = { id: number; grupo_id: number; apodo: string; avatar: string };

async function usuarioActual(req: Request): Promise<Usuario> {
  const token = req.headers.get("x-token") || "";
  if (!/^[a-f0-9]{64}$/.test(token)) salida(401, { error: "Falta el token" });
  const [u] = await sql<Usuario[]>`SELECT id, grupo_id, apodo, avatar FROM usuarios WHERE token = ${token}`;
  return u ?? salida(401, { error: "Token inválido" });
}

// Otorga una insignia por su código. Devuelve true si es nueva.
async function darInsignia(tx: postgres.Sql, uid: number, codigo: string): Promise<boolean> {
  const r = await tx`INSERT INTO usuario_insignias (usuario_id, insignia_id)
                     SELECT ${uid}::int, id FROM insignias WHERE codigo = ${codigo}
                     ON CONFLICT DO NOTHING`;
  return r.count > 0;
}

// ---------------------------------------------------------------------
// Avisos push (Web Push con VAPID)
// ---------------------------------------------------------------------
type Sub = { id: number; endpoint: string; p256dh: string; auth: string };
type Aviso = { titulo: string; cuerpo: string; url: string; tag?: string };

let vapidListo = false;
function vapidPublica(): string {
  const v = Deno.env.get("VAPID_PUBLIC_KEY");
  if (!v) throw new Error("Falta el secreto VAPID_PUBLIC_KEY");
  return v;
}

// Envía un aviso y devuelve el código HTTP del servicio push (0 si no hubo red)
async function pushEnviar(sub: Sub, aviso: Aviso): Promise<number> {
  if (!vapidListo) {
    webpush.setVapidDetails(
      Deno.env.get("VAPID_SUBJECT") || "mailto:novaquest@example.com",
      vapidPublica(),
      Deno.env.get("VAPID_PRIVATE_KEY") || "",
    );
    vapidListo = true;
  }
  try {
    const r = await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(aviso),
      { TTL: 86400, urgency: "normal" },
    );
    return r.statusCode;
  } catch (e: any) {
    if (e?.statusCode) return e.statusCode;
    console.error("NovaQuest push:", e?.message || e);
    return 0;
  }
}

// Un dato curioso al azar de la línea de tiempo (avisos de Rommel)
async function pushDatoCurioso(): Promise<Aviso> {
  const [ev] = await sql`SELECT id, titulo, texto FROM eventos_linea_tiempo ORDER BY RANDOM() LIMIT 1`;
  if (!ev) return { titulo: "🚀 NovaQuest", cuerpo: "¡Tu viaje en el tiempo te espera!", url: "linea-tiempo.html" };
  return { titulo: "⏳ ¿Sabías que...? " + ev.titulo, cuerpo: ev.texto, url: "linea-tiempo.html#momento-" + ev.id };
}

// Solo se aceptan endpoints de servicios push reales (Chrome/Edge/Firefox/Safari)
function pushJuegoEndpointValido(endpoint: string): boolean {
  if (!/^https:\/\/[^\s]{10,590}$/.test(endpoint)) return false;
  let host = "";
  try {
    host = new URL(endpoint).hostname.toLowerCase();
  } catch {
    return false;
  }
  return /(^|\.)(fcm\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com|push\.apple\.com)$/.test(host);
}

// Avisos del juego: envía y limpia la fila si el navegador la canceló
async function pushJuegoEnviarA(sub: Sub, aviso: Aviso): Promise<number> {
  const codigo = await pushEnviar(sub, { ...aviso, tag: "novaquest-juego" });
  if (codigo === 404 || codigo === 410) await sql`DELETE FROM push_juego WHERE id = ${sub.id}`;
  else if (codigo >= 200 && codigo < 300) await sql`UPDATE push_juego SET ultimo_envio = now() WHERE id = ${sub.id}`;
  return codigo;
}

async function puntosDe(uid: number): Promise<number> {
  const [r] = await sql`SELECT (COALESCE((SELECT SUM(puntos) FROM progreso WHERE usuario_id = ${uid}), 0)
                              + COALESCE((SELECT SUM(puntos) FROM progreso_etapas WHERE usuario_id = ${uid}), 0))::int AS p`;
  return r.p;
}

// "¡X te rebasó en el ranking!" a los compañeros que estaban arriba o empatados
async function pushJuegoRanking(u: Usuario, suma: number): Promise<void> {
  const ahora = await puntosDe(u.id);
  const antes = ahora - suma;
  const subs = await sql`SELECT s.id, s.endpoint, s.p256dh, s.auth, t.puntos
      FROM (SELECT u.id,
                   (COALESCE((SELECT SUM(puntos) FROM progreso WHERE usuario_id = u.id), 0)
                  + COALESCE((SELECT SUM(puntos) FROM progreso_etapas WHERE usuario_id = u.id), 0))::int AS puntos
            FROM usuarios u WHERE u.grupo_id = ${u.grupo_id} AND u.id <> ${u.id}) t
      JOIN push_juego s ON s.usuario_id = t.id
      WHERE t.puntos >= ${antes} AND t.puntos < ${ahora}
        AND (s.ultimo_ranking IS NULL OR s.ultimo_ranking < now() - make_interval(secs => ${ESPERA_RANKING}))`;
  for (const sub of subs) {
    const faltan = ahora - sub.puntos + 1;
    await pushJuegoEnviarA(sub as unknown as Sub, {
      titulo: "⚠️ ¡" + u.apodo + " te rebasó en el ranking!",
      cuerpo: `Ahora tiene ${ahora} pts. Te bastan ${faltan} pts para recuperar tu lugar, cadete 🚀`,
      url: "juego.html#misiones",
    });
    await sql`UPDATE push_juego SET ultimo_ranking = now() WHERE id = ${sub.id}`;
  }
}

// La misión que el cadete dejó a medias, o null si no tiene
async function pushJuegoRecordatorio(uid: number): Promise<Aviso | null> {
  const [m] = await sql`SELECT m.codigo, m.titulo,
        ((SELECT COUNT(*) FROM preguntas p JOIN articulos a ON a.id = p.articulo_id WHERE a.mision_id = m.id)
       - (SELECT COUNT(DISTINCT i.pregunta_id) FROM intentos i
            JOIN preguntas p ON p.id = i.pregunta_id JOIN articulos a ON a.id = p.articulo_id
           WHERE i.usuario_id = ${uid} AND a.mision_id = m.id AND i.correcta = 1))::int AS faltan
      FROM progreso pr JOIN misiones m ON m.id = pr.mision_id
      WHERE pr.usuario_id = ${uid} AND pr.estado = 'en_curso'
      ORDER BY pr.actualizado_en DESC LIMIT 1`;
  if (!m || m.faltan <= 0) return null;
  const n = m.faltan;
  return {
    titulo: "🛸 Tu misión " + m.codigo + " sigue a medias",
    cuerpo: "«" + m.titulo + "»: te " + (n === 1 ? "falta 1 pregunta" : `faltan ${n} preguntas`) + ". ¡Despega y termínala!",
    url: "juego.html#mision/" + m.codigo,
  };
}

function suscripcionValida(b: Record<string, any>) {
  const endpoint = String(b.endpoint ?? "");
  const p256dh = String(b.keys?.p256dh ?? "");
  const auth = String(b.keys?.auth ?? "");
  const ok = /^https:\/\/[^\s]{10,590}$/.test(endpoint) && /^[A-Za-z0-9_-]{80,100}$/.test(p256dh) &&
    /^[A-Za-z0-9_-]{16,30}$/.test(auth);
  return { ok, endpoint, p256dh, auth };
}

// ---------------------------------------------------------------------
// Rutas
// ---------------------------------------------------------------------
async function atender(req: Request): Promise<[number, unknown]> {
  const url = new URL(req.url);
  const recurso = url.searchParams.get("r") || "";
  const post = () => { if (req.method !== "POST") salida(405, { error: "Usa POST" }); };

  switch (recurso) {
    case "misiones":
      return [200, await sql`SELECT codigo, titulo, categoria, tipo, resumen, nivel, imagen
                             FROM misiones WHERE activa = 1 ORDER BY codigo`];

    case "mision": {
      const [m] = await sql`SELECT id, codigo, titulo, categoria, tipo, resumen, nivel, imagen
                            FROM misiones WHERE codigo = ${url.searchParams.get("codigo") || ""}`;
      if (!m) salida(404, { error: "Misión no encontrada" });
      const articulos = await sql`SELECT id, titulo, contenido FROM articulos WHERE mision_id = ${m.id} ORDER BY orden`;
      for (const a of articulos) {
        const preguntas = await sql`SELECT id, texto, puntos, explicacion FROM preguntas WHERE articulo_id = ${a.id} ORDER BY id`;
        for (const p of preguntas) {
          // No se envía es_correcta: el servidor es quien califica.
          const ops = await sql`SELECT id, texto, es_correcta FROM opciones WHERE pregunta_id = ${p.id} ORDER BY id`;
          const correcta = ops.find((o) => o.es_correcta === 1)?.id ?? 0;
          // Para jugar sin conexión: sha256(sal:id_correcta)
          p.sal = hexAlAzar(8);
          p.clave = await sha256(p.sal + ":" + correcta);
          p.opciones = ops.map((o) => ({ id: o.id, texto: o.texto }));
        }
        a.preguntas = preguntas;
      }
      return [200, { ...m, articulos }];
    }

    case "registro": {
      post();
      const b = await cuerpo(req);
      const apodo = String(b.apodo ?? "").trim();
      const avatar = String(b.avatar ?? "astronauta").replace(/[^a-z_]/g, "") || "astronauta";
      const largo = [...apodo].length;
      if (largo < 2 || largo > 30) salida(422, { error: "El apodo debe tener de 2 a 30 caracteres" });
      const [g] = await sql`SELECT id FROM grupos WHERE codigo = ${String(b.codigo_grupo ?? "").trim().toUpperCase()}`;
      if (!g) salida(404, { error: "Ese código de grupo no existe" });
      const token = hexAlAzar(32);
      try {
        await sql`INSERT INTO usuarios (grupo_id, apodo, avatar, token) VALUES (${g.id}, ${apodo}, ${avatar}, ${token})`;
      } catch (e: any) {
        if (e?.code === "23505") salida(409, { error: "Ese apodo ya existe en el grupo" });
        throw e;
      }
      return [201, { token, apodo, avatar }];
    }

    case "responder": {
      post();
      const u = await usuarioActual(req);
      const opcionId = Number.parseInt(String((await cuerpo(req)).opcion_id ?? 0), 10) || 0;
      const [o] = await sql`SELECT o.id, o.pregunta_id, o.es_correcta, p.puntos, p.explicacion, p.etapa_id, a.mision_id, mi.activa
                            FROM opciones o
                            JOIN preguntas p ON p.id = o.pregunta_id
                            LEFT JOIN articulos a ON a.id = p.articulo_id
                            LEFT JOIN misiones mi ON mi.id = a.mision_id
                            WHERE o.id = ${opcionId}`;
      if (!o) salida(404, { error: "Esa opción no existe" });
      if (o.mision_id !== null && !o.activa) salida(403, { error: "Esa misión no está disponible" });
      const esJuego = o.mision_id !== null;
      const destino: number = esJuego ? o.mision_id : o.etapa_id;
      const correcta = o.es_correcta === 1;

      const r = await sql.begin(async (tx) => {
        // ¿ya había acertado esta pregunta? (para no sumar puntos dos veces)
        const ya = await tx`SELECT 1 FROM intentos WHERE usuario_id = ${u.id} AND pregunta_id = ${o.pregunta_id} AND correcta = 1 LIMIT 1`;
        await tx`INSERT INTO intentos (usuario_id, pregunta_id, opcion_id, correcta)
                 VALUES (${u.id}, ${o.pregunta_id}, ${o.id}, ${o.es_correcta})`;
        const suma = correcta && ya.length === 0 ? o.puntos : 0;

        let total: number, acertadas: number;
        if (esJuego) {
          await tx`INSERT INTO progreso (usuario_id, mision_id, estado, puntos) VALUES (${u.id}, ${destino}, 'en_curso', ${suma})
                   ON CONFLICT (usuario_id, mision_id) DO UPDATE SET puntos = progreso.puntos + EXCLUDED.puntos`;
          [{ n: total }] = await tx`SELECT COUNT(*)::int AS n FROM preguntas p JOIN articulos a ON a.id = p.articulo_id WHERE a.mision_id = ${destino}`;
          [{ n: acertadas }] = await tx`SELECT COUNT(DISTINCT i.pregunta_id)::int AS n FROM intentos i
                   JOIN preguntas p ON p.id = i.pregunta_id JOIN articulos a ON a.id = p.articulo_id
                   WHERE i.usuario_id = ${u.id} AND a.mision_id = ${destino} AND i.correcta = 1`;
        } else {
          await tx`INSERT INTO progreso_etapas (usuario_id, etapa_id, estado, puntos) VALUES (${u.id}, ${destino}, 'en_curso', ${suma})
                   ON CONFLICT (usuario_id, etapa_id) DO UPDATE SET puntos = progreso_etapas.puntos + EXCLUDED.puntos`;
          [{ n: total }] = await tx`SELECT COUNT(*)::int AS n FROM preguntas WHERE etapa_id = ${destino}`;
          [{ n: acertadas }] = await tx`SELECT COUNT(DISTINCT i.pregunta_id)::int AS n FROM intentos i
                   JOIN preguntas p ON p.id = i.pregunta_id
                   WHERE i.usuario_id = ${u.id} AND p.etapa_id = ${destino} AND i.correcta = 1`;
        }
        const completada = total > 0 && acertadas >= total;
        const insignias: string[] = [];
        if (completada) {
          if (esJuego) {
            await tx`UPDATE progreso SET estado = 'completada' WHERE usuario_id = ${u.id} AND mision_id = ${destino}`;
            if (await darInsignia(tx, u.id, "primera_mision")) insignias.push("primera_mision");
            const [{ n }] = await tx`SELECT COUNT(*)::int AS n FROM progreso WHERE usuario_id = ${u.id} AND estado = 'completada'`;
            if (n >= 3 && await darInsignia(tx, u.id, "explorador")) insignias.push("explorador");
          } else {
            await tx`UPDATE progreso_etapas SET estado = 'completada' WHERE usuario_id = ${u.id} AND etapa_id = ${destino}`;
            // ¿Ya resolvió los retos de todas las etapas que tienen reto?
            const [{ n: hechas }] = await tx`SELECT COUNT(*)::int AS n FROM progreso_etapas WHERE usuario_id = ${u.id} AND estado = 'completada'`;
            const [{ n: conReto }] = await tx`SELECT COUNT(DISTINCT etapa_id)::int AS n FROM preguntas WHERE etapa_id IS NOT NULL`;
            if (hechas >= conReto && await darInsignia(tx, u.id, "viajero_tiempo")) insignias.push("viajero_tiempo");
          }
        }
        // Insignia "Científico": sus últimas 10 respuestas del juego fueron correctas
        if (esJuego && correcta) {
          const [racha] = await tx`SELECT COUNT(*)::int AS n, COALESCE(SUM(correcta), 0)::int AS ok FROM (
                                     SELECT i.correcta FROM intentos i JOIN preguntas p ON p.id = i.pregunta_id
                                     WHERE i.usuario_id = ${u.id} AND p.articulo_id IS NOT NULL
                                     ORDER BY i.id DESC LIMIT 10) ultimas`;
          if (racha.n === 10 && racha.ok === 10 && await darInsignia(tx, u.id, "cientifico")) insignias.push("cientifico");
        }
        return { suma, completada, insignias };
      });

      // Avisos del juego: un fallo aquí nunca debe romper la respuesta del disparo
      if (r.suma > 0 && esJuego) {
        try {
          await pushJuegoRanking(u, r.suma);
        } catch (e) {
          console.error("NovaQuest push juego:", e);
        }
      }
      return [200, {
        correcta, puntos_ganados: r.suma, completada: r.completada, insignias_nuevas: r.insignias,
        // El dato curioso solo se revela al acertar (no delata la respuesta)
        explicacion: correcta ? o.explicacion : null,
      }];
    }

    case "progreso": {
      const u = await usuarioActual(req);
      const misiones = await sql`SELECT m.codigo, p.estado, p.puntos FROM progreso p
                                 JOIN misiones m ON m.id = p.mision_id WHERE p.usuario_id = ${u.id}`;
      const etapas = await sql`SELECT e.nombre, p.estado, p.vinetas_vistas, p.puntos FROM progreso_etapas p
                               JOIN etapas e ON e.id = p.etapa_id WHERE p.usuario_id = ${u.id}`;
      const insignias = await sql`SELECT i.codigo, i.nombre FROM usuario_insignias ui
                                  JOIN insignias i ON i.id = ui.insignia_id WHERE ui.usuario_id = ${u.id}`;
      return [200, { usuario: u.apodo, misiones, etapas, insignias }];
    }

    case "ranking":
      return [200, await sql`SELECT u.apodo, u.avatar,
              (COALESCE((SELECT SUM(puntos) FROM progreso WHERE usuario_id = u.id), 0)
             + COALESCE((SELECT SUM(puntos) FROM progreso_etapas WHERE usuario_id = u.id), 0))::int AS puntos
             FROM usuarios u JOIN grupos g ON g.id = u.grupo_id
             WHERE g.codigo = ${(url.searchParams.get("codigo_grupo") || "").toUpperCase()}
             ORDER BY puntos DESC LIMIT 10`];

    case "linea_tiempo": {
      const [etapas, eventos, vinetas, preguntas, opciones] = await Promise.all([
        sql`SELECT id, nombre, descripcion FROM etapas ORDER BY orden`,
        sql`SELECT id, etapa_id, hace_millones, titulo, texto, icono FROM eventos_linea_tiempo ORDER BY orden`,
        sql`SELECT evento_id, dialogo, escena FROM vinetas ORDER BY evento_id, orden`,
        sql`SELECT id, etapa_id, texto, puntos FROM preguntas WHERE etapa_id IS NOT NULL ORDER BY id`,
        sql`SELECT o.id, o.pregunta_id, o.texto FROM opciones o JOIN preguntas p ON p.id = o.pregunta_id
            WHERE p.etapa_id IS NOT NULL ORDER BY o.id`,
      ]);
      // Árbol: etapa > eventos > viñetas, y etapa > reto > opciones (sin es_correcta)
      const agrupar = <T>(filas: any[], clave: string, f: (x: any) => T) => {
        const m = new Map<number, T[]>();
        for (const x of filas) m.set(x[clave], [...(m.get(x[clave]) ?? []), f(x)]);
        return m;
      };
      const vinPorEvento = agrupar(vinetas, "evento_id", (v) => ({ dialogo: v.dialogo, escena: v.escena }));
      const opPorPregunta = agrupar(opciones, "pregunta_id", (o) => ({ id: o.id, texto: o.texto }));
      const retoPorEtapa = agrupar(preguntas, "etapa_id", (p) => ({
        id: p.id, texto: p.texto, puntos: p.puntos, opciones: opPorPregunta.get(p.id) ?? [],
      }));
      return [200, etapas.map((e) => ({
        id: e.id, nombre: e.nombre, descripcion: e.descripcion,
        eventos: eventos.filter((ev) => ev.etapa_id === e.id).map((ev) => ({
          id: ev.id, hace_millones: Number(ev.hace_millones), titulo: ev.titulo, texto: ev.texto, icono: ev.icono,
          vinetas: vinPorEvento.get(ev.id) ?? [],
        })),
        reto: retoPorEtapa.get(e.id) ?? [],
      }))];
    }

    case "etapa_progreso": {
      post();
      const u = await usuarioActual(req);
      const b = await cuerpo(req);
      const etapaId = Number.parseInt(String(b.etapa_id ?? 0), 10) || 0;
      const vistas = Math.max(0, Math.min(255, Number.parseInt(String(b.vinetas_vistas ?? 0), 10) || 0));
      const ex = await sql`SELECT 1 FROM etapas WHERE id = ${etapaId}`;
      if (!ex.length) salida(404, { error: "Esa etapa no existe" });
      await sql`INSERT INTO progreso_etapas (usuario_id, etapa_id, estado, vinetas_vistas) VALUES (${u.id}, ${etapaId}, 'en_curso', ${vistas})
                ON CONFLICT (usuario_id, etapa_id) DO UPDATE
                SET vinetas_vistas = GREATEST(progreso_etapas.vinetas_vistas, EXCLUDED.vinetas_vistas)`;
      return [200, { ok: true }];
    }

    case "reiniciar_tiempo": {
      post();
      const u = await usuarioActual(req);
      // Solo el progreso de la línea de tiempo; las misiones no se tocan
      await sql.begin(async (tx) => {
        await tx`DELETE FROM progreso_etapas WHERE usuario_id = ${u.id}`;
        await tx`DELETE FROM intentos WHERE usuario_id = ${u.id}
                 AND pregunta_id IN (SELECT id FROM preguntas WHERE etapa_id IS NOT NULL)`;
        await tx`DELETE FROM usuario_insignias WHERE usuario_id = ${u.id}
                 AND insignia_id IN (SELECT id FROM insignias WHERE codigo = 'viajero_tiempo')`;
      });
      return [200, { ok: true }];
    }

    // ----- Avisos de la línea del tiempo (tabla push_suscripciones) -----
    case "push_clave":
      return [200, { clave: vapidPublica() }];

    case "push_suscribir": {
      post();
      const s = suscripcionValida(await cuerpo(req));
      if (!s.ok) salida(422, { error: "Suscripción inválida" });
      // El token es opcional: los avisos también sirven sin cadete
      const uid = req.headers.has("x-token") ? (await usuarioActual(req)).id : null;
      await sql`INSERT INTO push_suscripciones (usuario_id, endpoint_hash, endpoint, p256dh, auth)
                VALUES (${uid}, ${await sha256(s.endpoint)}, ${s.endpoint}, ${s.p256dh}, ${s.auth})
                ON CONFLICT (endpoint_hash) DO UPDATE SET usuario_id = COALESCE(EXCLUDED.usuario_id, push_suscripciones.usuario_id),
                                                          p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`;
      return [201, { ok: true }];
    }

    case "push_baja": {
      post();
      await sql`DELETE FROM push_suscripciones WHERE endpoint_hash = ${await sha256(String((await cuerpo(req)).endpoint ?? ""))}`;
      return [200, { ok: true }];
    }

    case "push_prueba": {
      post();
      const [sub] = await sql`SELECT id, endpoint, p256dh, auth,
                                     CAST(EXTRACT(EPOCH FROM (now() - ultimo_envio)) AS INTEGER) AS hace
                              FROM push_suscripciones WHERE endpoint_hash = ${await sha256(String((await cuerpo(req)).endpoint ?? ""))}`;
      if (!sub) salida(404, { error: "Primero activa los avisos" });
      // Máximo un aviso de prueba cada 20 segundos por navegador
      if (sub.hace !== null && sub.hace < 20) salida(429, { error: "Espera unos segundos antes de pedir otro aviso" });
      const codigo = await pushEnviar(sub as unknown as Sub, await pushDatoCurioso());
      if (codigo === 404 || codigo === 410) {
        await sql`DELETE FROM push_suscripciones WHERE id = ${sub.id}`;
        salida(410, { error: "Tu suscripción venció. Vuelve a activar los avisos." });
      }
      if (codigo < 200 || codigo >= 300) salida(502, { error: `El servicio de avisos no respondió (código ${codigo})` });
      await sql`UPDATE push_suscripciones SET ultimo_envio = now() WHERE id = ${sub.id}`;
      return [200, { ok: true }];
    }

    // ----- Jefe final del videojuego: puntos extra -----
    case "jefe": {
      post();
      const u = await usuarioActual(req);
      const codigo = String((await cuerpo(req)).mision ?? "");
      const [mi] = await sql`SELECT id, activa FROM misiones WHERE codigo = ${codigo}`;
      if (!mi) salida(404, { error: "Misión no encontrada" });
      if (!mi.activa) salida(403, { error: "Esa misión no está disponible" });
      // El jefe sale después de la última pregunta: la misión debe estar completada
      const hecha = await sql`SELECT 1 FROM progreso WHERE usuario_id = ${u.id} AND mision_id = ${mi.id} AND estado = 'completada'`;
      if (!hecha.length) salida(409, { error: "Primero responde todas las preguntas de la misión" });
      const bono = JEFE_PUNTOS[codigo] ?? 20;
      const primera = await sql.begin(async (tx) => {
        const ins = await tx`INSERT INTO jefes_derrotados (usuario_id, mision_id, puntos) VALUES (${u.id}, ${mi.id}, ${bono})
                             ON CONFLICT DO NOTHING`;
        if (ins.count > 0) {
          await tx`UPDATE progreso SET puntos = puntos + ${bono} WHERE usuario_id = ${u.id} AND mision_id = ${mi.id}`;
        }
        return ins.count > 0;
      });
      if (primera) {
        try {
          await pushJuegoRanking(u, bono);
        } catch (e) {
          console.error("NovaQuest push juego:", e);
        }
      }
      return [200, { puntos_ganados: primera ? bono : 0, primera_vez: primera }];
    }

    // ----- Avisos del videojuego (tabla push_juego) -----
    case "juego_avisos_estado": {
      post();
      const u = await usuarioActual(req);
      const st = await sql`SELECT 1 FROM push_juego
                           WHERE endpoint_hash = ${await sha256(String((await cuerpo(req)).endpoint ?? ""))} AND usuario_id = ${u.id}`;
      return [200, { activo: st.length > 0 }];
    }

    case "juego_avisos_suscribir": {
      post();
      const u = await usuarioActual(req);
      const s = suscripcionValida(await cuerpo(req));
      if (!s.ok || !pushJuegoEndpointValido(s.endpoint)) salida(422, { error: "Suscripción inválida" });
      // Si el navegador ya era de otro cadete, ahora es del que tiene la sesión
      await sql`INSERT INTO push_juego (usuario_id, endpoint_hash, endpoint, p256dh, auth)
                VALUES (${u.id}, ${await sha256(s.endpoint)}, ${s.endpoint}, ${s.p256dh}, ${s.auth})
                ON CONFLICT (endpoint_hash) DO UPDATE SET usuario_id = EXCLUDED.usuario_id,
                                                          p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`;
      return [201, { ok: true }];
    }

    case "juego_avisos_baja": {
      post();
      const u = await usuarioActual(req);
      await sql`DELETE FROM push_juego
                WHERE endpoint_hash = ${await sha256(String((await cuerpo(req)).endpoint ?? ""))} AND usuario_id = ${u.id}`;
      return [200, { ok: true }];
    }

    case "juego_avisos_prueba": {
      post();
      const u = await usuarioActual(req);
      const [sub] = await sql`SELECT id, endpoint, p256dh, auth,
                                     CAST(EXTRACT(EPOCH FROM (now() - ultimo_envio)) AS INTEGER) AS hace
                              FROM push_juego
                              WHERE endpoint_hash = ${await sha256(String((await cuerpo(req)).endpoint ?? ""))} AND usuario_id = ${u.id}`;
      if (!sub) salida(404, { error: "Primero activa los avisos del juego" });
      if (sub.hace !== null && sub.hace < 20) salida(429, { error: "Espera unos segundos antes de pedir otro aviso" });
      // Si tiene una misión a medias se le recuerda; si no, un aviso de bienvenida
      const aviso = await pushJuegoRecordatorio(u.id) ?? {
        titulo: "🎮 ¡Hola, " + u.apodo + "!",
        cuerpo: "Así te avisaremos cuando alguien te rebase en el ranking o dejes una misión a medias.",
        url: "juego.html#misiones",
      };
      const codigo = await pushJuegoEnviarA(sub as unknown as Sub, aviso);
      if (codigo === 404 || codigo === 410) salida(410, { error: "Tu suscripción venció. Vuelve a activar los avisos." });
      if (codigo < 200 || codigo >= 300) salida(502, { error: `El servicio de avisos no respondió (código ${codigo})` });
      return [200, { ok: true }];
    }

    default:
      return [404, { error: "Recurso desconocido" }];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  let codigo: number, datos: unknown;
  try {
    [codigo, datos] = await atender(req);
  } catch (e) {
    if (e instanceof Salida) {
      [codigo, datos] = [e.codigo, e.datos];
    } else {
      console.error("NovaQuest API:", e);
      [codigo, datos] = [500, { error: "Error interno del servidor" }];
    }
  }
  return new Response(JSON.stringify(datos), {
    status: codigo,
    headers: { ...cors(req), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
});
