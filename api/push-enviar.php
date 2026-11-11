<?php
// =====================================================================
// Envía un "¿Sabías que...?" de la línea de tiempo a todos los navegadores
// suscritos. Solo se ejecuta desde la terminal (no desde el navegador):
//
//   C:\MAMP\bin\php\php8.3.1\php.exe -c C:\MAMP\conf\php8.3.1\php.ini api\push-enviar.php
//
// Para enviarlo solo cada día, prográmalo en el Programador de tareas
// de Windows con ese mismo comando.
// =====================================================================
declare(strict_types=1);
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('Solo desde la terminal');
}
require __DIR__ . '/push.php';

$pdo = conectarBD(); // MySQL o PostgreSQL según config.php (api/db.php)

$aviso = pushDatoCurioso($pdo);
echo "Aviso: {$aviso['titulo']}\n";
$enviados = $vencidos = $fallidos = 0;
foreach ($pdo->query('SELECT id, endpoint, p256dh, auth FROM push_suscripciones')->fetchAll() as $sub) {
    $codigo = pushEnviar($sub, $aviso);
    if ($codigo >= 200 && $codigo < 300) {
        $enviados++;
        $pdo->prepare('UPDATE push_suscripciones SET ultimo_envio = NOW() WHERE id = ?')->execute([$sub['id']]);
    } elseif ($codigo === 404 || $codigo === 410) {
        // El navegador canceló la suscripción: se borra
        $vencidos++;
        $pdo->prepare('DELETE FROM push_suscripciones WHERE id = ?')->execute([$sub['id']]);
    } else {
        $fallidos++;
        echo "  Falló #{$sub['id']} (código $codigo)\n";
    }
}
echo "Enviados: $enviados · Vencidos borrados: $vencidos · Fallidos: $fallidos\n";
