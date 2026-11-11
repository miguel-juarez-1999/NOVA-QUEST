<?php
// =====================================================================
// Avisos push del videojuego (Cadetes NovaQuest).
// Usa el motor de api/push.php (cifrado + VAPID) sin modificarlo; solo
// decide QUÉ avisar y A QUIÉN. Las suscripciones viven en push_juego.
//   - Ranking:      "¡X te rebasó en tu grupo!" (se envía al instante)
//   - Recordatorio: "Tu misión sigue a medias" (api/juego/enviar.php)
// =====================================================================
declare(strict_types=1);
require_once __DIR__ . '/../push.php';

// Segundos mínimos entre dos avisos de ranking al mismo navegador
const PUSH_JUEGO_ESPERA_RANKING = 120;

// Solo se aceptan endpoints de servicios push reales (Chrome/Edge/Firefox/Safari)
function pushJuegoEndpointValido(string $endpoint): bool {
    if (!preg_match('#^https://[^\s]{10,590}$#', $endpoint)) return false;
    $host = strtolower((string)parse_url($endpoint, PHP_URL_HOST));
    return (bool)preg_match('/(^|\.)(fcm\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com|push\.apple\.com)$/', $host);
}

// Envía a una suscripción y limpia la fila si el navegador la canceló.
// Devuelve el código HTTP del servicio push.
function pushJuegoEnviarA(PDO $pdo, array $sub, array $aviso): int {
    $codigo = pushEnviar($sub, $aviso + ['tag' => 'novaquest-juego']);
    if ($codigo === 404 || $codigo === 410) {
        $pdo->prepare('DELETE FROM push_juego WHERE id = ?')->execute([$sub['id']]);
    } elseif ($codigo >= 200 && $codigo < 300) {
        $pdo->prepare('UPDATE push_juego SET ultimo_envio = NOW() WHERE id = ?')->execute([$sub['id']]);
    }
    return $codigo;
}

// Puntos totales de un cadete (misma suma que el ranking de api/index.php)
function pushJuegoPuntos(PDO $pdo, int $uid): int {
    $st = $pdo->prepare('SELECT COALESCE((SELECT SUM(puntos) FROM progreso WHERE usuario_id = ?), 0)
                              + COALESCE((SELECT SUM(puntos) FROM progreso_etapas WHERE usuario_id = ?), 0)');
    $st->execute([$uid, $uid]);
    return (int)$st->fetchColumn();
}

// Se llama desde r=responder cuando el cadete acaba de sumar $suma puntos.
// Avisa a los compañeros de su grupo que estaban arriba o empatados y
// ahora quedaron abajo.
function pushJuegoRanking(PDO $pdo, array $u, int $suma): void {
    $ahora = pushJuegoPuntos($pdo, (int)$u['id']);
    $antes = $ahora - $suma;
    $st = $pdo->prepare('SELECT s.id, s.endpoint, s.p256dh, s.auth, t.puntos
        FROM (SELECT u.id,
                     COALESCE((SELECT SUM(puntos) FROM progreso WHERE usuario_id = u.id), 0)
                   + COALESCE((SELECT SUM(puntos) FROM progreso_etapas WHERE usuario_id = u.id), 0) AS puntos
              FROM usuarios u WHERE u.grupo_id = ? AND u.id <> ?) t
        JOIN push_juego s ON s.usuario_id = t.id
        WHERE t.puntos >= ? AND t.puntos < ?
          AND (s.ultimo_ranking IS NULL OR s.ultimo_ranking < ' . sqlHaceSegundos($pdo, PUSH_JUEGO_ESPERA_RANKING) . ')');
    $st->execute([$u['grupo_id'], $u['id'], $antes, $ahora]);
    foreach ($st->fetchAll() as $sub) {
        $faltan = $ahora - (int)$sub['puntos'] + 1;
        pushJuegoEnviarA($pdo, $sub, [
            'titulo' => '⚠️ ¡' . $u['apodo'] . ' te rebasó en el ranking!',
            'cuerpo' => "Ahora tiene $ahora pts. Te bastan $faltan pts para recuperar tu lugar, cadete 🚀",
            'url'    => 'juego.html#misiones',
        ]);
        $pdo->prepare('UPDATE push_juego SET ultimo_ranking = NOW() WHERE id = ?')->execute([$sub['id']]);
    }
}

// Recordatorio para un cadete: la misión que dejó a medias, o null si no tiene
function pushJuegoRecordatorio(PDO $pdo, int $uid): ?array {
    $st = $pdo->prepare("SELECT m.codigo, m.titulo,
            (SELECT COUNT(*) FROM preguntas p JOIN articulos a ON a.id = p.articulo_id WHERE a.mision_id = m.id)
          - (SELECT COUNT(DISTINCT i.pregunta_id) FROM intentos i
               JOIN preguntas p ON p.id = i.pregunta_id JOIN articulos a ON a.id = p.articulo_id
              WHERE i.usuario_id = ? AND a.mision_id = m.id AND i.correcta = 1) AS faltan
        FROM progreso pr JOIN misiones m ON m.id = pr.mision_id
        WHERE pr.usuario_id = ? AND pr.estado = 'en_curso'
        ORDER BY pr.actualizado_en DESC LIMIT 1");
    $st->execute([$uid, $uid]);
    $m = $st->fetch();
    if (!$m || (int)$m['faltan'] <= 0) return null;
    $n = (int)$m['faltan'];
    return [
        'titulo' => '🛸 Tu misión ' . $m['codigo'] . ' sigue a medias',
        'cuerpo' => '«' . $m['titulo'] . '»: te ' . ($n === 1 ? 'falta 1 pregunta' : "faltan $n preguntas") . '. ¡Despega y termínala!',
        'url'    => 'juego.html#mision/' . $m['codigo'],
    ];
}
