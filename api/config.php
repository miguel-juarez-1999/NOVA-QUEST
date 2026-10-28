<?php
// Configuración de conexión. XAMPP trae estos valores por defecto.
// Si tu MySQL tiene contraseña, crea api/config.local.php con tus valores
// (se usará en lugar de estos).
if (file_exists(__DIR__ . '/config.local.php')) {
    return require __DIR__ . '/config.local.php';
}
return [
    'host'    => '127.0.0.1',
    'port'    => 3306,
    'dbname'  => 'novaquest',
    'user'    => 'root',
    'pass'    => 'root',
    'charset' => 'utf8mb4',
];