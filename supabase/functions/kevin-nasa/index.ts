// =====================================================================
// APORTACIÓN KEVIN: backend público HTTPS para NQ Orbit Explorer
// =====================================================================
// Supabase Edge Function:
// - conserva la clave NASA y la clave privada VAPID fuera del navegador;
// - guarda datos en cache_api_nasa, objetos_nasa y aproximaciones_nasa;
// - registra y prueba suscripciones reales en push_nasa.
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2.76.1";
import webpush from "npm:web-push@3.6.7";

const allowedOrigins = new Set([
  "https://kevinjimarez.github.io",
  "http://127.0.0.1:8094",
  "http://localhost:8094",
]);

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") || "";
  const localOrigin = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin);
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) || localOrigin ? origin : "https://kevinjimarez.github.io",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(request: Request, status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(request), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function body(request: Request): Promise<Record<string, unknown>> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function parseNasaDate(value: string): Date | null {
  // NeoWs suele enviar "2026-Nov-03 07:03". Convertimos el mes en inglés
  // antes de crear el ISO que PostgreSQL/Supabase almacenará.
  const months: Record<string, string> = {
    Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
    Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
  };
  const match = value.match(/^(\d{4})-([A-Za-z]{3})-(\d{2})(?:\s+(\d{2}:\d{2}))?$/);
  const normalized = match
    ? `${match[1]}-${months[match[2]] || ""}-${match[3]}T${match[4] || "00:00"}:00Z`
    : /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function requiredSecret(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Falta configurar el secreto ${name}.`);
  return value;
}

function supabaseServerKey(): string {
  // Los proyectos recientes entregan las claves privadas en un diccionario JSON.
  // La clave sb_secret_ se usa solamente dentro de esta Edge Function y nunca
  // se envía al navegador. Se conserva la variable heredada como respaldo.
  const encodedKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (encodedKeys) {
    try {
      const keys = JSON.parse(encodedKeys);
      const pending: unknown[] = [keys];
      while (pending.length) {
        const item = pending.shift();
        if (typeof item === "string" && item.startsWith("sb_secret_")) return item;
        if (Array.isArray(item)) pending.push(...item);
        else if (item && typeof item === "object") pending.push(...Object.values(item));
      }
    } catch {
      // Si cambia el formato, la clave heredada mantiene compatibilidad.
    }
  }
  return requiredSecret("SUPABASE_SERVICE_ROLE_KEY");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request) });

  const url = new URL(request.url);
  const route = url.searchParams.get("r") || "salud";
  const supabase = createClient(
    requiredSecret("SUPABASE_URL"),
    supabaseServerKey(),
    { auth: { persistSession: false } },
  );

  try {
    if (route === "salud") {
      const { error } = await supabase.from("cache_api_nasa").select("clave").limit(1);
      if (error) throw error;
      return json(request, 200, { ok: true, modulo: "kevin-nasa", plataforma: "supabase" });
    }

    if (route === "nasa_feed") {
      if (request.method !== "GET") return json(request, 405, { error: "Usa GET." });
      const date = url.searchParams.get("fecha") || new Date().toISOString().slice(0, 10);
      const force = url.searchParams.get("forzar") === "1";
      if (!validDate(date)) return json(request, 400, { error: "Fecha inválida. Usa AAAA-MM-DD." });
      const cacheKey = `neo-feed:${date}`;

      if (!force) {
        const { data: cached, error } = await supabase
          .from("cache_api_nasa")
          .select("respuesta, consultado_en")
          .eq("clave", cacheKey)
          .gt("expira_en", new Date().toISOString())
          .maybeSingle();
        if (error) throw error;
        if (cached) {
          return json(request, 200, {
            ...cached.respuesta,
            _novaquest: { fuente: "cache_api_nasa", consultado_en: cached.consultado_en },
          });
        }
      }

      const nasaKey = Deno.env.get("NASA_API_KEY") || "DEMO_KEY";
      const nasaUrl = new URL("https://api.nasa.gov/neo/rest/v1/feed");
      nasaUrl.searchParams.set("start_date", date);
      nasaUrl.searchParams.set("end_date", date);
      nasaUrl.searchParams.set("api_key", nasaKey);
      const nasaResponse = await fetch(nasaUrl);
      if (!nasaResponse.ok) throw new Error(`NASA respondió HTTP ${nasaResponse.status}.`);
      const payload = await nasaResponse.json();
      const now = new Date();
      const expires = new Date(now.getTime() + 6 * 60 * 60 * 1000);
      const { error: cacheError } = await supabase.from("cache_api_nasa").upsert({
        clave: cacheKey,
        respuesta: payload,
        consultado_en: now.toISOString(),
        expira_en: expires.toISOString(),
      }, { onConflict: "clave" });
      if (cacheError) throw cacheError;

      const objects = Object.values(payload.near_earth_objects || {}).flat() as Array<Record<string, any>>;
      for (const object of objects) {
        const diameter = object.estimated_diameter?.meters || {};
        const { data: saved, error: objectError } = await supabase.from("objetos_nasa").upsert({
          nasa_id: String(object.id),
          nombre: object.name || "Objeto sin nombre",
          tipo: "asteroide",
          magnitud_absoluta: object.absolute_magnitude_h ?? null,
          diametro_min_m: diameter.estimated_diameter_min ?? null,
          diametro_max_m: diameter.estimated_diameter_max ?? null,
          potencialmente_peligroso: Boolean(object.is_potentially_hazardous_asteroid),
          url_jpl: object.nasa_jpl_url ?? null,
          datos_json: object,
          actualizado_en: now.toISOString(),
        }, { onConflict: "nasa_id" }).select("id").single();
        if (objectError) throw objectError;

        for (const approach of object.close_approach_data || []) {
          const rawDate = approach.close_approach_date_full || approach.close_approach_date;
          const parsedDate = parseNasaDate(String(rawDate || ""));
          if (!parsedDate) continue;
          const { error: approachError } = await supabase.from("aproximaciones_nasa").upsert({
            objeto_nasa_id: saved.id,
            fecha_aproximacion: parsedDate.toISOString(),
            cuerpo_orbitado: approach.orbiting_body || "Earth",
            velocidad_kmh: approach.relative_velocity?.kilometers_per_hour ?? null,
            distancia_km: approach.miss_distance?.kilometers ?? null,
            distancia_lunar: approach.miss_distance?.lunar ?? null,
            datos_json: approach,
          }, { onConflict: "objeto_nasa_id,fecha_aproximacion,cuerpo_orbitado" });
          if (approachError) throw approachError;
        }
      }
      return json(request, 200, { ...payload, _novaquest: { fuente: "nasa_api", guardado_en: "cache_api_nasa" } });
    }

    // APORTACIÓN KEVIN: elementos orbitales oficiales de JPL/SBDB.
    // NeoWs aporta los acercamientos; SBDB agrega semieje mayor,
    // excentricidad e inclinación para dibujar una trayectoria coherente.
    if (route === "nasa_orbit") {
      if (request.method !== "GET") return json(request, 405, { error: "Usa GET." });
      const id = url.searchParams.get("id") || "";
      if (!/^\d{4,12}$/.test(id)) return json(request, 400, { error: "Identificador NASA inválido." });
      const cacheKey = `sbdb-orbit:${id}`;
      const { data: cached, error: cacheReadError } = await supabase
        .from("cache_api_nasa")
        .select("respuesta, consultado_en")
        .eq("clave", cacheKey)
        .gt("expira_en", new Date().toISOString())
        .maybeSingle();
      if (cacheReadError) throw cacheReadError;
      if (cached) return json(request, 200, { ...cached.respuesta, _novaquest: { fuente: "cache_api_nasa", consultado_en: cached.consultado_en } });

      const sbdbUrl = new URL("https://ssd-api.jpl.nasa.gov/sbdb.api");
      sbdbUrl.searchParams.set("sstr", id);
      sbdbUrl.searchParams.set("phys-par", "1");
      const sbdbResponse = await fetch(sbdbUrl);
      if (!sbdbResponse.ok) throw new Error(`JPL SBDB respondió HTTP ${sbdbResponse.status}.`);
      const payload = await sbdbResponse.json();
      const now = new Date();
      const { error: cacheWriteError } = await supabase.from("cache_api_nasa").upsert({
        clave: cacheKey,
        respuesta: payload,
        consultado_en: now.toISOString(),
        expira_en: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }, { onConflict: "clave" });
      if (cacheWriteError) throw cacheWriteError;
      return json(request, 200, { ...payload, _novaquest: { fuente: "jpl_sbdb", guardado_en: "cache_api_nasa" } });
    }

    if (route === "push_clave") {
      if (request.method !== "GET") return json(request, 405, { error: "Usa GET." });
      return json(request, 200, { clave: requiredSecret("VAPID_PUBLIC_KEY") });
    }

    if (route === "push_suscribir") {
      if (request.method !== "POST") return json(request, 405, { error: "Usa POST." });
      const data = await body(request);
      const endpoint = String(data.endpoint || "");
      const keys = (data.keys || {}) as Record<string, unknown>;
      if (!endpoint.startsWith("https://") || !keys.p256dh || !keys.auth) {
        return json(request, 400, { error: "Suscripción Web Push inválida." });
      }
      const { error } = await supabase.from("push_nasa").upsert({
        endpoint_hash: await sha256(endpoint),
        endpoint,
        p256dh: String(keys.p256dh),
        auth: String(keys.auth),
      }, { onConflict: "endpoint_hash" });
      if (error) throw error;
      return json(request, 201, { ok: true, suscripcion: "push_nasa" });
    }

    if (route === "push_prueba") {
      if (request.method !== "POST") return json(request, 405, { error: "Usa POST." });
      const data = await body(request);
      const endpoint = String(data.endpoint || "");
      const hash = await sha256(endpoint);
      const { data: subscription, error } = await supabase.from("push_nasa").select("*").eq("endpoint_hash", hash).maybeSingle();
      if (error) throw error;
      if (!subscription) return json(request, 404, { error: "El dispositivo no está suscrito." });
      if (subscription.ultimo_envio && Date.parse(subscription.ultimo_envio) > Date.now() - 20_000) {
        return json(request, 429, { error: "Espera unos segundos antes de solicitar otra prueba." });
      }

      webpush.setVapidDetails(
        Deno.env.get("VAPID_SUBJECT") || "mailto:novaquest@example.com",
        requiredSecret("VAPID_PUBLIC_KEY"),
        requiredSecret("VAPID_PRIVATE_KEY"),
      );
      try {
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        }, JSON.stringify({
          titulo: "☄️ NovaQuest · Radar NASA",
          cuerpo: "Tu explorador está conectado. Toca para revisar los objetos cercanos a la Tierra.",
          url: "explorador.html#datos",
          tag: "novaquest-kevin-nasa",
        }), { TTL: 60, urgency: "high" });
      } catch (pushError: any) {
        if ([404, 410].includes(pushError.statusCode)) {
          await supabase.from("push_nasa").delete().eq("id", subscription.id);
          return json(request, 410, { error: "La suscripción venció; actívala nuevamente." });
        }
        throw pushError;
      }
      await supabase.from("push_nasa").update({ ultimo_envio: new Date().toISOString() }).eq("id", subscription.id);
      return json(request, 200, { ok: true });
    }

    if (route === "push_baja") {
      if (request.method !== "POST") return json(request, 405, { error: "Usa POST." });
      const data = await body(request);
      await supabase.from("push_nasa").delete().eq("endpoint_hash", await sha256(String(data.endpoint || "")));
      return json(request, 200, { ok: true });
    }

    return json(request, 404, { error: "Ruta Kevin/NASA no encontrada." });
  } catch (error) {
    console.error("NovaQuest Kevin API", error);
    return json(request, 500, { error: "No fue posible completar la operación.", detalle: String(error?.message || error) });
  }
});
