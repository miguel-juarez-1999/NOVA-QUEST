// Avisos push del videojuego (Cadetes NovaQuest).
// El navegador tiene UNA sola suscripción push para todo el sitio; aquí se
// reutiliza (o se crea) y se registra en la tabla del juego (push_juego).
// Desactivar los avisos del juego NO cancela la suscripción del navegador,
// para no apagar los avisos de la línea del tiempo.
const AvisosJuego = (() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const BANDERA = "nq_avisos_juego";
  const soportado = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const leer = () => { try { return localStorage.getItem(BANDERA); } catch { return null; } };
  const marcar = (activo) => { try { activo ? localStorage.setItem(BANDERA, "1") : localStorage.removeItem(BANDERA); } catch { /* sin almacenamiento */ } };

  function base64ABytes(b64) {
    const bin = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  }

  function mismaClave(sub, clave) {
    const actual = sub.options?.applicationServerKey;
    if (!actual) return true; // el navegador no la expone: se asume la misma
    const a = new Uint8Array(actual);
    return a.length === clave.length && a.every((b, i) => b === clave[i]);
  }

  function registroListo() {
    return Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, no) => setTimeout(() => no(new Error("El modo sin internet no está listo. Recarga la página.")), 8000))
    ]);
  }

  function explicar(error) {
    if (/push service error/i.test(error.message)) {
      return "El navegador no pudo conectarse a su servicio de avisos. Si usas Brave, activa «Usar los servicios de Google para mensajería push» en brave://settings/privacy.";
    }
    return error.message || "Algo salió mal.";
  }

  function pintar(activo, texto) {
    const caja = $("[data-avisos-juego]");
    if (!caja) return;
    $("[data-avisos-juego-activar]").hidden = activo || !soportado;
    $("[data-avisos-juego-probar]").hidden = !activo;
    $("[data-avisos-juego-desactivar]").hidden = !activo;
    caja.classList.toggle("activa", Boolean(activo));
    const estado = $("[data-avisos-juego-estado]");
    if (texto != null) estado.textContent = texto;
    else if (!soportado) estado.textContent = "😕 Este navegador no permite avisos.";
    else if (Notification.permission === "denied")
      estado.textContent = "🔕 Los avisos están bloqueados. Un adulto puede permitirlos en el candado 🔒 junto a la dirección de la página.";
    else estado.textContent = activo ? "✅ Te avisaremos si alguien te rebasa o dejas una misión a medias." : "";
  }

  // Devuelve la suscripción del navegador, creándola si no existe o si se
  // hizo con otra clave del servidor
  async function suscripcion(reg) {
    const [{ clave }, actual] = await Promise.all([NQ.llamar("push_clave"), reg.pushManager.getSubscription()]);
    const bytes = base64ABytes(clave);
    if (actual && mismaClave(actual, bytes)) return actual;
    if (actual) await actual.unsubscribe();
    return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
  }

  // Al entrar a las misiones: muestra si están activos. Si el cadete los
  // había activado pero la suscripción del navegador cambió, se registra la
  // nueva sin preguntar.
  async function revisar() {
    if (!soportado) return pintar(false);
    try {
      const reg = await registroListo();
      const sub = await reg.pushManager.getSubscription();
      if (Notification.permission !== "granted") return pintar(false);
      if (!sub) {
        if (leer()) await NQ.llamar("juego_avisos_suscribir", { metodo: "POST", datos: (await suscripcion(reg)).toJSON() });
        return pintar(Boolean(leer()));
      }
      const { activo } = await NQ.llamar("juego_avisos_estado", { metodo: "POST", datos: { endpoint: sub.endpoint } });
      if (!activo && leer()) {
        await NQ.llamar("juego_avisos_suscribir", { metodo: "POST", datos: sub.toJSON() });
        return pintar(true);
      }
      pintar(activo);
    } catch {
      pintar(false);
    }
  }

  async function activar() {
    const boton = $("[data-avisos-juego-activar]");
    boton.disabled = true;
    pintar(false, "Preparando...");
    try {
      if ((await Notification.requestPermission()) !== "granted") {
        pintar(false, Notification.permission === "denied" ? null : "Está bien, puedes activarlos cuando quieras.");
        return;
      }
      const sub = await suscripcion(await registroListo());
      await NQ.llamar("juego_avisos_suscribir", { metodo: "POST", datos: sub.toJSON() });
      marcar(true);
      pintar(true, "✅ ¡Listo, cadete! Te avisaremos si alguien te rebasa en el ranking.");
      local("🎮 ¡Avisos del juego activados!", "Así se verán tus avisos de Cadetes NovaQuest.");
    } catch (error) {
      pintar(false, "😕 No se pudieron activar los avisos: " + explicar(error));
    } finally {
      boton.disabled = false;
    }
  }

  async function probar() {
    const boton = $("[data-avisos-juego-probar]");
    boton.disabled = true;
    try {
      const sub = await (await registroListo()).pushManager.getSubscription();
      if (!sub) throw new Error("Primero activa los avisos del juego.");
      await NQ.llamar("juego_avisos_prueba", { metodo: "POST", datos: { endpoint: sub.endpoint } });
      pintar(true, "📨 ¡Enviado! Tu aviso llegará en unos segundos.");
    } catch (error) {
      const vencio = /venció|activa/.test(error.message);
      if (vencio) marcar(false);
      pintar(!vencio, "😕 " + explicar(error));
    } finally {
      setTimeout(() => { boton.disabled = false; }, 3000);
    }
  }

  async function desactivar() {
    try {
      const sub = await (await registroListo()).pushManager.getSubscription();
      if (sub) await NQ.llamar("juego_avisos_baja", { metodo: "POST", datos: { endpoint: sub.endpoint } });
      marcar(false);
      pintar(false, "🔕 Avisos del juego desactivados.");
    } catch (error) {
      pintar(true, "😕 " + explicar(error));
    }
  }

  // Notificación local (sin servidor) para logros del momento, solo si ya
  // hay permiso. Ej.: una insignia nueva o una misión cumplida.
  function local(titulo, cuerpo) {
    if (!soportado || Notification.permission !== "granted") return;
    navigator.serviceWorker.ready
      .then((reg) => reg.showNotification(titulo, {
        body: cuerpo,
        icon: "assets/icons/icon-192.png",
        badge: "assets/icons/icon-192.png",
        tag: "novaquest-juego-logro",
        lang: "es",
        data: { url: "juego.html#misiones" }
      }))
      .catch(() => {});
  }

  // Al salir de la sesión, el navegador deja de recibir avisos de ese cadete
  async function olvidar() {
    try {
      const sub = soportado && leer() ? await (await registroListo()).pushManager.getSubscription() : null;
      if (sub) await NQ.llamar("juego_avisos_baja", { metodo: "POST", datos: { endpoint: sub.endpoint } });
    } catch { /* sin conexión: se limpia cuando el servicio push la rechace */ }
    marcar(false);
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("[data-avisos-juego-activar]")?.addEventListener("click", activar);
    $("[data-avisos-juego-probar]")?.addEventListener("click", probar);
    $("[data-avisos-juego-desactivar]")?.addEventListener("click", desactivar);
  });

  return { revisar, local, olvidar };
})();
