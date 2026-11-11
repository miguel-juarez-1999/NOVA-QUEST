<?php
// Configuración de conexión. XAMPP trae estos valores por defecto.
// Si tu MySQL tiene contraseña, crea api/config.local.php con tus valores
// (se usará en lugar de estos).
//
// Para usar la base de Supabase (PostgreSQL) pon esto en config.local.php
// (Supabase > Connect > Session pooler) o en variables de entorno NQ_DB_*:
//   'driver' => 'pgsql',
//   'host'   => 'aws-0-<region>.pooler.supabase.com',
//   'port'   => 5432,
//   'dbname' => 'postgres',
//   'user'   => 'postgres.<id-del-proyecto>',
//   'pass'   => '<contraseña de la base>',
// PHP necesita la extensión pdo_pgsql (en MAMP: extension=php_pdo_pgsql.dll).
// En un hosting la conexión llega por variables de entorno (no se sube la contraseña)
if (getenv('NQ_DB_HOST')) {
    return [
        'driver'  => getenv('NQ_DB_DRIVER') ?: 'pgsql',
        'host'    => getenv('NQ_DB_HOST'),
        'port'    => (int)(getenv('NQ_DB_PORT') ?: 5432),
        'dbname'  => getenv('NQ_DB_NAME') ?: 'postgres',
        'user'    => getenv('NQ_DB_USER'),
        'pass'    => getenv('NQ_DB_PASS'),
        'sslmode' => getenv('NQ_DB_SSLMODE') ?: 'require',
    ];
}
if (file_exists(__DIR__ . '/config.local.php')) {
    return require __DIR__ . '/config.local.php';
}
return [
    'driver'  => 'mysql',
    'host'    => '127.0.0.1',
    'port'    => 3307,
    //'port'    => 3307,
    'dbname'  => 'novaquest',
    'user'    => 'root',
    'pass'    => 'root',
    'charset' => 'utf8mb4',
];