<?php
// =====================================================================
// Conexión a la base de NovaQuest: MySQL (MAMP/XAMPP local) o PostgreSQL
// (Supabase). Se elige con 'driver' en api/config.php / config.local.php:
//   'driver' => 'mysql'  (por defecto)   o   'driver' => 'pgsql'
//
// Casi todo el SQL de la API funciona igual en los dos motores; lo poco
// que cambia (upsert, fechas, azar) se arma con las funciones de abajo.
// =====================================================================
declare(strict_types=1);

function conectarBD(): PDO {
    $c  = require __DIR__ . '/config.php';
    $pg = ($c['driver'] ?? 'mysql') === 'pgsql';
    $dsn = $pg
        ? "pgsql:host={$c['host']};port={$c['port']};dbname={$c['dbname']};sslmode=" . ($c['sslmode'] ?? 'require')
        : "mysql:host={$c['host']};port={$c['port']};dbname={$c['dbname']};charset=" . ($c['charset'] ?? 'utf8mb4');
    return new PDO($dsn, $c['user'], $c['pass'], [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        // En Supabase el pooler puede ir en modo "transaction", que no admite
        // sentencias preparadas del servidor: PDO las prepara él mismo.
        PDO::ATTR_EMULATE_PREPARES   => $pg,
    ]);
}

function esPg(PDO $pdo): bool {
    return $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'pgsql';
}

// ¿El error es por un valor repetido (UNIQUE / PRIMARY KEY)?
function esDuplicado(PDOException $e): bool {
    return in_array((string)$e->getCode(), ['23000', '23505'], true);
}

// INSERT que no hace nada si la fila ya existe (en MySQL: INSERT IGNORE).
// rowCount() dice si de verdad se insertó.
function sqlInsertarSiNoExiste(PDO $pdo, string $insert): string {
    return esPg($pdo)
        ? "$insert ON CONFLICT DO NOTHING"
        : preg_replace('/^\s*INSERT\s+INTO/i', 'INSERT IGNORE INTO', $insert);
}

// "Si ya existe la fila, actualízala" para el final de un INSERT.
//   $claves: columnas de la llave única (las usa PostgreSQL)
//   $cambios: columna => cómo actualizarla
//      'nuevo'      el valor que se intentó insertar
//      'sumar'      el actual + el nuevo
//      'mayor'      el mayor de los dos
//      'si_viene'   el nuevo si no es NULL; si no, se queda el actual
function sqlAlRepetir(PDO $pdo, string $tabla, array $claves, array $cambios): string {
    $pg = esPg($pdo);
    $partes = [];
    foreach ($cambios as $col => $modo) {
        $nuevo  = $pg ? "EXCLUDED.$col" : "VALUES($col)";
        $actual = $pg ? "$tabla.$col" : $col;
        $partes[] = "$col = " . match ($modo) {
            'nuevo'    => $nuevo,
            'sumar'    => "$actual + $nuevo",
            'mayor'    => "GREATEST($actual, $nuevo)",
            'si_viene' => "COALESCE($nuevo, $actual)",
        };
    }
    return $pg
        ? 'ON CONFLICT (' . implode(', ', $claves) . ') DO UPDATE SET ' . implode(', ', $partes)
        : 'ON DUPLICATE KEY UPDATE ' . implode(', ', $partes);
}

// Segundos que pasaron desde la fecha de una columna (NULL si está vacía)
function sqlSegundosDesde(PDO $pdo, string $col): string {
    return esPg($pdo)
        ? "CAST(EXTRACT(EPOCH FROM (now() - $col)) AS INTEGER)"
        : "TIMESTAMPDIFF(SECOND, $col, NOW())";
}

// Momento de hace $seg segundos
function sqlHaceSegundos(PDO $pdo, int $seg): string {
    return esPg($pdo) ? "now() - interval '$seg seconds'" : "NOW() - INTERVAL $seg SECOND";
}

// Orden al azar
function sqlAzar(PDO $pdo): string {
    return esPg($pdo) ? 'RANDOM()' : 'RAND()';
}
