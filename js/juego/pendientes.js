// Bandeja de respuestas del juego hechas sin conexión (IndexedDB).
// La usan la página (js/juego/juego.js) y el service worker (sw.js, con
// importScripts), por eso no toca el DOM ni localStorage.
self.NQPendientes = (() => {
  "use strict";

  const BD = "novaquest", ALMACEN = "respuestas";

  function abrir() {
    return new Promise((ok, no) => {
      const pet = indexedDB.open(BD, 1);
      pet.onupgradeneeded = () => pet.result.createObjectStore(ALMACEN, { keyPath: "id", autoIncrement: true });
      pet.onsuccess = () => ok(pet.result);
      pet.onerror = () => no(pet.error);
    });
  }
  async function usar(modo, fn) {
    const bd = await abrir();
    return new Promise((ok, no) => {
      const tx = bd.transaction(ALMACEN, modo), pet = fn(tx.objectStore(ALMACEN));
      tx.oncomplete = () => { bd.close(); ok(pet && pet.result); };
      tx.onerror = () => { bd.close(); no(tx.error); };
    });
  }

  const guardar = (item) => usar("readwrite", (a) => a.add({ ...item, creado: Date.now() }));
  const todas = () => usar("readonly", (a) => a.getAll());
  const borrar = (id) => usar("readwrite", (a) => a.delete(id));
  const contar = () => usar("readonly", (a) => a.count());

  // Envía las respuestas guardadas al servidor, en orden. Si se cae la red a la
  // mitad, se detiene y lo que falta se queda para la próxima vez.
  let enviando = null;
  function enviar(base) {
    if (enviando) return enviando;
    enviando = (async () => {
      const res = { enviadas: 0, puntos: 0, insignias: [] };
      for (const item of await todas()) {
        let r;
        try {
          // Una respuesta del juego, o el jefe final derrotado (puntos extra)
          const [ruta, datos] = item.jefe ? ["jefe", { mision: item.jefe }] : ["responder", { opcion_id: item.opcion_id }];
          // NQ.url (js/api.js): PHP en la computadora, Supabase publicada
          r = await fetch(typeof NQ !== "undefined" ? NQ.url(ruta) : new URL("api/index.php?r=" + ruta, base), {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Token": item.token },
            body: JSON.stringify(datos)
          });
        } catch {
          break; // sin conexión otra vez
        }
        // 2xx: guardada. 4xx: ya no se puede guardar (opción borrada, sesión cerrada): se descarta
        if (r.ok || (r.status >= 400 && r.status < 500)) {
          await borrar(item.id);
          if (r.ok) {
            const json = await r.json().catch(() => ({}));
            res.enviadas += 1;
            res.puntos += Number(json.puntos_ganados || 0);
            res.insignias.push(...(json.insignias_nuevas || []));
          }
        } else break; // error del servidor: se intenta después
      }
      return res;
    })().finally(() => { enviando = null; });
    return enviando;
  }

  return { guardar, todas, contar, enviar };
})();
