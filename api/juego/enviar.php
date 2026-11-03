<?php
// =====================================================================
// Envía el recordatorio "Tu misión sigue a medias" a los cadetes que
// activaron los avisos del juego. Solo se ejecuta desde la terminal:
//
//   C:\MAMP\bin\php\php8.3.1\php.exe -c C:\MAMP\conf\php8.3.1\php.ini C:\MAMP\htdocs\APP9\api\push-juego-enviar.php
//
// Para enviarlo cada día, prográmalo en el Programador de tareas de
// Windows con ese mismo comando.
// =====================================================================
declare(strict_types=1);
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('Solo desde la terminal');
}
require __DIR__ . '/avisos.php';

$c = require __DIR__ . '/../config.php';
$pdo = new PDO("mysql:host={$c['host']};port={$c['port']};dbname={$c['dbname']};charset={$c['charset']}",
               $c['user'], $c['pass'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                                        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);

$enviados = $sinPendientes = $vencidos = $fallidos = 0;
foreach ($pdo->query('SELECT id, usuario_id, endpoint, p256dh, auth FROM push_juego')->fetchAll() as $sub) {
    $aviso = pushJuegoRecordatorio($pdo, (int)$sub['usuario_id']);
    if (!$aviso) { $sinPendientes++; continue; }
    $codigo = pushJuegoEnviarA($pdo, $sub, $aviso);
    if ($codigo >= 200 && $codigo < 300) $enviados++;
    elseif ($codigo === 404 || $codigo === 410) $vencidos++;
    else { $fallidos++; echo "  Falló #{$sub['id']} (código $codigo)\n"; }
}
echo "Enviados: $enviados · Sin misiones pendientes: $sinPendientes · Vencidos borrados: $vencidos · Fallidos: $fallidos\n";
