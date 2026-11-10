<?php
// APORTACIÓN KEVIN: envío manual a todos los dispositivos de push_nasa.
// Se ejecuta desde terminal en el servidor; nunca desde el navegador:
//   php api/kevin/enviar.php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('Solo desde la terminal.');
}

$config = require __DIR__ . '/../config.php';
require_once __DIR__ . '/../push.php';
$pdo = new PDO(
    "mysql:host={$config['host']};port={$config['port']};dbname={$config['dbname']};charset={$config['charset']}",
    $config['user'],
    $config['pass'],
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
);

$aviso = [
    'titulo' => '☄️ NovaQuest · Radar NASA',
    'cuerpo' => 'Hay una actualización del catálogo de objetos cercanos a la Tierra.',
    'url' => 'explorador.html#datos',
    'tag' => 'novaquest-kevin-nasa',
];
$enviados = $vencidos = $fallidos = 0;
foreach ($pdo->query('SELECT id, endpoint, p256dh, auth FROM push_nasa')->fetchAll() as $suscripcion) {
    $codigo = pushEnviar($suscripcion, $aviso);
    if ($codigo >= 200 && $codigo < 300) {
        $enviados++;
        $pdo->prepare('UPDATE push_nasa SET ultimo_envio = NOW() WHERE id = ?')->execute([$suscripcion['id']]);
    } elseif ($codigo === 404 || $codigo === 410) {
        $vencidos++;
        $pdo->prepare('DELETE FROM push_nasa WHERE id = ?')->execute([$suscripcion['id']]);
    } else {
        $fallidos++;
    }
}
echo "Enviados: {$enviados} · Vencidos: {$vencidos} · Fallidos: {$fallidos}\n";
