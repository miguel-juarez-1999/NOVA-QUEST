<?php
// =====================================================================
// Pruebas del videojuego (API + base de datos). Solo desde la terminal:
//
//   C:\MAMP\bin\php\php8.3.1\php.exe -c C:\MAMP\conf\php8.3.1\php.ini C:\MAMP\htdocs\APP9\tests\juego.php
//
// Usa la API real (http://localhost/APP9 o la URL que se pase como primer
// argumento) con un cadete temporal que se borra al terminar.
// =====================================================================
declare(strict_types=1);
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('Solo desde la terminal');
}

$base = rtrim($argv[1] ?? 'http://localhost/APP9', '/') . '/api/index.php?r=';
require __DIR__ . '/../api/db.php';
$pdo = conectarBD(); // la misma base que usa la API (MySQL o Supabase)

$ok = $mal = 0;
function revisar(string $que, bool $paso, string $detalle = ''): void {
    global $ok, $mal;
    $paso ? $ok++ : $mal++;
    echo ($paso ? '  ✅ ' : '  ❌ ') . $que . ($paso || $detalle === '' ? '' : "  →  $detalle") . "\n";
}
// Petición a la API: devuelve [código HTTP, json]
function api(string $r, ?array $datos = null, ?string $token = null, string $extra = ''): array {
    global $base;
    $ch = curl_init($base . $r . $extra);
    $h = ['Content-Type: application/json'];
    if ($token) $h[] = "X-Token: $token";
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => $h, CURLOPT_TIMEOUT => 20]);
    if ($datos !== null) { curl_setopt($ch, CURLOPT_POST, true); curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($datos)); }
    $cuerpo = curl_exec($ch);
    $codigo = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [$codigo, json_decode((string)$cuerpo, true)];
}
function correctaDe(PDO $pdo, int $preguntaId): int {
    $st = $pdo->prepare('SELECT id FROM opciones WHERE pregunta_id = ? AND es_correcta = 1');
    $st->execute([$preguntaId]);
    return (int)$st->fetchColumn();
}

$token = null;
try {
    echo "\n📚 Contenido de las misiones\n";
    [$cod, $misiones] = api('misiones');
    revisar('La lista de misiones responde', $cod === 200 && is_array($misiones));
    revisar('Hay 6 misiones', count($misiones ?? []) === 6, (string)count($misiones ?? []));
    $todas = [];
    foreach ($misiones ?? [] as $m) {
        [$cod, $det] = api('mision', null, null, '&codigo=' . urlencode($m['codigo']));
        $preguntas = array_merge(...array_map(fn($a) => $a['preguntas'], $det['articulos'] ?? [[]] ) ?: [[]]);
        $bien = $cod === 200 && count($det['articulos']) >= 1 && count($preguntas) >= 4;
        revisar("{$m['codigo']} tiene lectura y al menos 4 preguntas", $bien, count($preguntas) . ' preguntas');
        $texto = $det['articulos'][0]['contenido'] ?? '';
        $palabras = count(preg_split('/\s+/u', trim($texto)));
        revisar("{$m['codigo']} tiene un artículo (subtítulos, recuadro y 250+ palabras)",
            substr_count($texto, "## ") >= 2 && str_contains($texto, "> ") && $palabras >= 250, "$palabras palabras");
        foreach ($preguntas as $p) $todas[$m['codigo']][] = $p;
    }

    echo "\n🔒 La respuesta correcta no viaja al navegador\n";
    $p = $todas['NQ-03'][0];
    $json = json_encode($p);
    revisar('El detalle no incluye es_correcta', !str_contains($json, 'es_correcta'));
    revisar('Cada pregunta trae sal y clave (para jugar sin conexión)', isset($p['sal'], $p['clave']));
    $buena = correctaDe($pdo, (int)$p['id']);
    revisar('La clave coincide solo con la opción correcta',
        hash('sha256', $p['sal'] . ':' . $buena) === $p['clave']
        && count(array_filter($p['opciones'], fn($o) => hash('sha256', $p['sal'] . ':' . $o['id']) === $p['clave'])) === 1);

    echo "\n🧑‍🚀 Registro y respuestas\n";
    [$cod, $reg] = api('registro', ['codigo_grupo' => 'DEMO01', 'apodo' => 'ZZPrueba' . random_int(1000, 9999), 'avatar' => 'cohete']);
    $token = $reg['token'] ?? null;
    revisar('Se registra un cadete temporal', $cod === 201 && $token !== null, (string)$cod);
    [$cod] = api('responder', ['opcion_id' => $buena]);
    revisar('Responder sin sesión se rechaza (401)', $cod === 401, (string)$cod);

    $mala = (int)array_values(array_filter($p['opciones'], fn($o) => (int)$o['id'] !== $buena))[0]['id'];
    [$cod, $r] = api('responder', ['opcion_id' => $mala], $token);
    revisar('Una respuesta incorrecta no suma puntos', $cod === 200 && $r['correcta'] === false && $r['puntos_ganados'] === 0);
    revisar('Al fallar no se revela el dato curioso', ($r['explicacion'] ?? null) === null);
    [$cod, $r] = api('responder', ['opcion_id' => $buena], $token);
    revisar('Una respuesta correcta suma sus puntos', $cod === 200 && $r['correcta'] === true && $r['puntos_ganados'] > 0);
    [$cod, $r] = api('responder', ['opcion_id' => $buena], $token);
    revisar('Repetir la misma correcta no vuelve a sumar', $r['puntos_ganados'] === 0);

    echo "\n🏅 Misiones completas e insignias\n";
    $insignias = [];
    $completadas = 0;
    foreach (['NQ-03', 'NQ-01', 'NQ-02'] as $codigo) {
        foreach ($todas[$codigo] as $q) {
            [, $r] = api('responder', ['opcion_id' => correctaDe($pdo, (int)$q['id'])], $token);
            $insignias = array_merge($insignias, $r['insignias_nuevas'] ?? []);
            if (!empty($r['completada'])) $completadas++;
        }
    }
    revisar('Contestar todo bien completa las 3 misiones', $completadas >= 3, (string)$completadas);
    revisar('Gana "Astronauta novato" (primera misión)', in_array('primera_mision', $insignias, true));
    revisar('Gana "Explorador" (3 misiones)', in_array('explorador', $insignias, true));
    revisar('Gana "Científico" (10 correctas seguidas)', in_array('cientifico', $insignias, true));
    [$cod, $prog] = api('progreso', null, $token);
    revisar('El progreso muestra las 3 misiones completadas',
        count(array_filter($prog['misiones'] ?? [], fn($m) => $m['estado'] === 'completada')) >= 3);
    [$cod, $rank] = api('ranking', null, null, '&codigo_grupo=DEMO01');
    revisar('El cadete aparece en el ranking de su grupo', in_array($reg['apodo'], array_column($rank ?? [], 'apodo'), true));

    echo "\n👾 Jefe final\n";
    [$cod] = api('jefe', ['mision' => 'NQ-06'], $token);
    revisar('Sin terminar las preguntas no hay puntos extra (409)', $cod === 409, (string)$cod);
    $antes = (int)$pdo->query("SELECT p.puntos FROM progreso p JOIN misiones m ON m.id = p.mision_id
                               JOIN usuarios u ON u.id = p.usuario_id WHERE m.codigo = 'NQ-03' AND u.token = " . $pdo->quote($token))->fetchColumn();
    [$cod, $r] = api('jefe', ['mision' => 'NQ-03'], $token);
    revisar('Derrotar al jefe de NQ-03 da 30 puntos extra', $cod === 200 && ($r['puntos_ganados'] ?? 0) === 30, json_encode($r));
    $despues = (int)$pdo->query("SELECT p.puntos FROM progreso p JOIN misiones m ON m.id = p.mision_id
                                 JOIN usuarios u ON u.id = p.usuario_id WHERE m.codigo = 'NQ-03' AND u.token = " . $pdo->quote($token))->fetchColumn();
    revisar('Los puntos extra se suman al progreso de la misión', $despues === $antes + 30, "$antes → $despues");
    [$cod, $r] = api('jefe', ['mision' => 'NQ-03'], $token);
    revisar('Volver a derrotarlo no da más puntos', $cod === 200 && ($r['puntos_ganados'] ?? -1) === 0);
    [$cod] = api('jefe', ['mision' => 'NQ-03']);
    revisar('Sin sesión se rechaza (401)', $cod === 401, (string)$cod);

    echo "\n🚫 Misión desactivada\n";
    $pdo->exec("UPDATE misiones SET activa = 0 WHERE codigo = 'NQ-06'");
    try {
        [$cod] = api('responder', ['opcion_id' => correctaDe($pdo, (int)$todas['NQ-06'][0]['id'])], $token);
        revisar('No se califican preguntas de una misión desactivada (403)', $cod === 403, (string)$cod);
    } finally {
        $pdo->exec("UPDATE misiones SET activa = 1 WHERE codigo = 'NQ-06'");
    }

    echo "\n🔔 Avisos push del juego\n";
    [$cod] = api('juego_avisos_estado', ['endpoint' => 'x']);
    revisar('Sin sesión se rechaza (401)', $cod === 401, (string)$cod);
    [$cod] = api('juego_avisos_suscribir', ['endpoint' => 'https://evil.example.com/robar',
        'keys' => ['p256dh' => str_repeat('A', 87), 'auth' => str_repeat('a', 22)]], $token);
    revisar('Un endpoint que no es de un servicio push se rechaza (422)', $cod === 422, (string)$cod);
    [$cod, $r] = api('juego_avisos_estado', ['endpoint' => 'https://fcm.googleapis.com/fcm/send/prueba'], $token);
    revisar('El estado de los avisos responde', $cod === 200 && ($r['activo'] ?? null) === false);
    [$cod] = api('juego_avisos_prueba', ['endpoint' => 'https://fcm.googleapis.com/fcm/send/prueba'], $token);
    revisar('Probar sin suscripción pide activarlos (404)', $cod === 404, (string)$cod);
} catch (Throwable $e) {
    revisar('Las pruebas terminaron sin errores', false, $e->getMessage());
} finally {
    if ($token) $pdo->prepare('DELETE FROM usuarios WHERE token = ?')->execute([$token]);
}

echo "\n" . ($mal === 0 ? "✅ Todo bien: $ok pruebas pasaron" : "❌ $mal de " . ($ok + $mal) . " pruebas fallaron") . "\n";
exit($mal === 0 ? 0 : 1);
