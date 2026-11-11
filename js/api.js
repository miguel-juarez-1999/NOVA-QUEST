// Cliente mínimo para la API de NovaQuest.
//   - En la computadora (localhost / 127.0.0.1): el PHP de api/index.php.
//   - Publicada (GitHub Pages): la Edge Function "novaquest" de Supabase,
//     que tiene las mismas rutas y respuestas.
// Guarda el token del niño en localStorage; no se guardan datos personales.
// El service worker también carga este archivo (importScripts) para usar NQ.url.
const NQ_SUPABASE_API = "https://gjuhbuhrxtnmnibhfzxw.supabase.co/functions/v1/novaquest";

const NQ = {
  // ¿Corre en la computadora? Entonces hay PHP; si no, se usa Supabase.
  local: /^(localhost|127\.0\.0\.1|\[::1\])$/.test(self.location.hostname),
  // URL completa de una ruta de la API, p. ej. NQ.url("mision", { codigo: "NQ-01" })
  url(recurso, params = {}) {
    const query = new URLSearchParams({ r: recurso, ...params });
    return NQ.local
      ? new URL(`api/index.php?${query}`, self.registration ? self.registration.scope : self.location.href).href
      : `${NQ_SUPABASE_API}?${query}`;
  },
  async llamar(recurso, { metodo = "GET", datos, params = {} } = {}) {
    const token = (() => {
      try {
        return localStorage.getItem("nq_token");
      } catch {
        return null;
      }
    })();
    const respuesta = await fetch(NQ.url(recurso, params), {
      method: metodo,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "X-Token": token } : {}),
      },
      body: datos ? JSON.stringify(datos) : undefined,
    });
    const json = await respuesta.json();
    if (!respuesta.ok) throw new Error(json.error || "Error de servidor");
    return json;
  },
  misiones: () => NQ.llamar("misiones"),
  mision: (codigo) => NQ.llamar("mision", { params: { codigo } }),
  lineaTiempo: () => NQ.llamar("linea_tiempo"),
  objetos: () => NQ.llamar("objetos"),
  progreso: () => NQ.llamar("progreso"),
  responder: (opcion_id) =>
    NQ.llamar("responder", { metodo: "POST", datos: { opcion_id } }),
  async registrar(codigo_grupo, apodo, avatar) {
    const r = await NQ.llamar("registro", {
      metodo: "POST",
      datos: { codigo_grupo, apodo, avatar },
    });
    try {
      localStorage.setItem("nq_token", r.token);
    } catch {}
    return r;
  },
};

// Registra el service worker (modo sin internet). Va aquí porque api.js se
// carga en todas las páginas.
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((e) => console.warn("SW no registrado:", e));
  });
}
