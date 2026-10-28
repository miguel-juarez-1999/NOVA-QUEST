// Cliente mínimo para la API de NovaQuest (api/index.php).
// Guarda el token del niño en localStorage; no se guardan datos personales.
const NQ = {
  async llamar(recurso, { metodo = "GET", datos, params = {} } = {}) {
    const query = new URLSearchParams({ r: recurso, ...params });
    const token = (() => {
      try {
        return localStorage.getItem("nq_token");
      } catch {
        return null;
      }
    })();
    const respuesta = await fetch(`api/index.php?${query}`, {
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
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((e) => console.warn("SW no registrado:", e));
  });
}
