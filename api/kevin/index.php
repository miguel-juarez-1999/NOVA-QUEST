<?php
// =====================================================================
// APORTACIÓN KEVIN: API independiente del NQ Orbit Explorer
// =====================================================================
// Este archivo une cuatro piezas sin modificar los endpoints del equipo:
//   1. NASA NeoWs (fuente externa de objetos cercanos a la Tierra).
//   2. MySQL/MariaDB (caché y catálogo normalizado de la integración).
//   3. Web Push (suscripciones guardadas únicamente en push_nasa).
//   4. La PWA (explorador.html), tanto local como publicada por HTTPS.
//
// Rutas disponibles:
//   GET  ?r=salud
//   GET  ?r=nasa_feed&fecha=AAAA-MM-DD&forzar=1
//   GET  ?r=push_clave
//   POST ?r=push_suscribir
//   POST ?r=push_prueba
//   POST ?r=push_baja
// =====================================================================
declare(strict_types=1);

const NASA_CACHE_HORAS = 6;

// GitHub Pages y los servidores locales autorizados pueden consultar esta API.
// En producción se puede reemplazar o ampliar mediante config.local.php.
$config = require __DIR__ . '/../config.php';
$origenesPermitidos = $config['allowed_origins'] ?? [
    'https://kevinjimarez.github.io',
    'http://127.0.0.1:8094',
    'http://localhost:8094',
];
$origen = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origen !== '' && (in_array($origen, $origenesPermitidos, true)
    || preg_match('#^http://(127\.0\.0\.1|localhost)(:\d+)?$#', $origen))) {
    header('Access-Control-Allow-Origin: ' . $origen);
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept');
header('Cache-Control: no-store');
header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function responder(int $codigo, array $datos): never {
    http_response_code($codigo);
    echo json_encode($datos, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function cuerpoJson(): array {
    $entrada = file_get_contents('php://input');
    if ($entrada === false || trim($entrada) === '') return [];
    $datos = json_decode($entrada, true);
    if (!is_array($datos)) responder(400, ['error' => 'El cuerpo debe ser JSON válido.']);
    return $datos;
}

function dbKevin(array $config): PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;
    $dsn = "mysql:host={$config['host']};port={$config['port']};dbname={$config['dbname']};charset={$config['charset']}";
    $pdo = new PDO($dsn, $config['user'], $config['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    return $pdo;
}

function fechaValida(string $fecha): bool {
    $objeto = DateTimeImmutable::createFromFormat('!Y-m-d', $fecha);
    return $objeto instanceof DateTimeImmutable && $objeto->format('Y-m-d') === $fecha;
}

function nasaDescargar(string $url): array {
    $curl = curl_init($url);
    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_HTTPHEADER => ['Accept: application/json', 'User-Agent: NovaQuest-UTP/1.0'],
    ]);
    $texto = curl_exec($curl);
    $codigo = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
    $error = curl_error($curl);
    if (!is_string($texto) || $codigo < 200 || $codigo >= 300) {
        throw new RuntimeException($error !== '' ? $error : "NASA respondió HTTP {$codigo}");
    }
    $datos = json_decode($texto, true);
    if (!is_array($datos)) throw new RuntimeException('NASA no devolvió un JSON válido.');
    return $datos;
}

function guardarObjetosNASA(PDO $pdo, array $payload): void {
    $objetos = [];
    foreach (($payload['near_earth_objects'] ?? []) as $lista) {
        if (is_array($lista)) $objetos = array_merge($objetos, $lista);
    }
    $objetoSql = $pdo->prepare(
        'INSERT INTO objetos_nasa
         (nasa_id, nombre, tipo, magnitud_absoluta, diametro_min_m, diametro_max_m,
          potencialmente_peligroso, url_jpl, datos_json)
         VALUES (?, ?, \'asteroide\', ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE nombre=VALUES(nombre), magnitud_absoluta=VALUES(magnitud_absoluta),
          diametro_min_m=VALUES(diametro_min_m), diametro_max_m=VALUES(diametro_max_m),
          potencialmente_peligroso=VALUES(potencialmente_peligroso), url_jpl=VALUES(url_jpl),
          datos_json=VALUES(datos_json), actualizado_en=CURRENT_TIMESTAMP'
    );
    $buscarId = $pdo->prepare('SELECT id FROM objetos_nasa WHERE nasa_id = ?');
    $aproximacionSql = $pdo->prepare(
        'INSERT INTO aproximaciones_nasa
         (objeto_nasa_id, fecha_aproximacion, cuerpo_orbitado, velocidad_kmh,
          distancia_km, distancia_lunar, datos_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE velocidad_kmh=VALUES(velocidad_kmh),
          distancia_km=VALUES(distancia_km), distancia_lunar=VALUES(distancia_lunar),
          datos_json=VALUES(datos_json)'
    );

    foreach ($objetos as $objeto) {
        if (!is_array($objeto) || empty($objeto['id'])) continue;
        $diametro = $objeto['estimated_diameter']['meters'] ?? [];
        $objetoSql->execute([
            (string) $objeto['id'],
            (string) ($objeto['name'] ?? 'Objeto sin nombre'),
            $objeto['absolute_magnitude_h'] ?? null,
            $diametro['estimated_diameter_min'] ?? null,
            $diametro['estimated_diameter_max'] ?? null,
            !empty($objeto['is_potentially_hazardous_asteroid']) ? 1 : 0,
            $objeto['nasa_jpl_url'] ?? null,
            json_encode($objeto, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ]);
        $buscarId->execute([(string) $objeto['id']]);
        $id = (int) $buscarId->fetchColumn();
        foreach (($objeto['close_approach_data'] ?? []) as $paso) {
            $fechaCruda = (string) ($paso['close_approach_date_full'] ?? $paso['close_approach_date'] ?? '');
            try {
                // NASA puede responder "2026-Nov-03 07:03"; MySQL necesita
                // el formato numérico "2026-11-03 07:03:00".
                $fecha = (new DateTimeImmutable($fechaCruda))->format('Y-m-d H:i:s');
            } catch (Throwable) {
                $fecha = '';
            }
            if ($id <= 0 || !$fecha) continue;
            $aproximacionSql->execute([
                $id,
                $fecha,
                (string) ($paso['orbiting_body'] ?? 'Earth'),
                $paso['relative_velocity']['kilometers_per_hour'] ?? null,
                $paso['miss_distance']['kilometers'] ?? null,
                $paso['miss_distance']['lunar'] ?? null,
                json_encode($paso, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ]);
        }
    }
}

function endpointPushValido(string $endpoint): bool {
    $host = strtolower((string) parse_url($endpoint, PHP_URL_HOST));
    return $host !== '' && (bool) preg_match(
        '/(^|\.)(fcm\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com|push\.apple\.com)$/',
        $host
    );
}

$ruta = (string) ($_GET['r'] ?? 'salud');
$metodo = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    switch ($ruta) {
        case 'salud':
            $pdo = dbKevin($config);
            $pdo->query('SELECT 1');
            responder(200, [
                'ok' => true,
                'modulo' => 'kevin-nasa',
                'base_datos' => $config['dbname'],
                'hora_servidor' => gmdate('c'),
            ]);

        case 'nasa_feed':
            if ($metodo !== 'GET') responder(405, ['error' => 'Usa GET.']);
            $fecha = (string) ($_GET['fecha'] ?? date('Y-m-d'));
            if (!fechaValida($fecha)) responder(400, ['error' => 'Fecha inválida. Usa AAAA-MM-DD.']);
            $clave = 'neo-feed:' . $fecha;
            $forzar = ($_GET['forzar'] ?? '') === '1';
            $pdo = dbKevin($config);

            if (!$forzar) {
                $consulta = $pdo->prepare('SELECT respuesta, consultado_en FROM cache_api_nasa WHERE clave = ? AND expira_en > NOW()');
                $consulta->execute([$clave]);
                $cache = $consulta->fetch();
                if ($cache) {
                    $payload = json_decode($cache['respuesta'], true);
                    $payload['_novaquest'] = ['fuente' => 'cache_api_nasa', 'consultado_en' => $cache['consultado_en']];
                    responder(200, $payload);
                }
            }

            $apiKey = (string) ($config['nasa_api_key'] ?? 'DEMO_KEY');
            $url = 'https://api.nasa.gov/neo/rest/v1/feed?start_date=' . rawurlencode($fecha)
                 . '&end_date=' . rawurlencode($fecha) . '&api_key=' . rawurlencode($apiKey);
            $payload = nasaDescargar($url);
            $texto = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            $guardar = $pdo->prepare(
                'INSERT INTO cache_api_nasa (clave, respuesta, consultado_en, expira_en)
                 VALUES (?, ?, NOW(), DATE_ADD(NOW(), INTERVAL ' . NASA_CACHE_HORAS . ' HOUR))
                 ON DUPLICATE KEY UPDATE respuesta=VALUES(respuesta), consultado_en=NOW(), expira_en=VALUES(expira_en)'
            );
            $pdo->beginTransaction();
            $guardar->execute([$clave, $texto]);
            guardarObjetosNASA($pdo, $payload);
            $pdo->commit();
            $payload['_novaquest'] = ['fuente' => 'nasa_api', 'guardado_en' => 'cache_api_nasa'];
            responder(200, $payload);

        case 'push_clave':
            if ($metodo !== 'GET') responder(405, ['error' => 'Usa GET.']);
            require_once __DIR__ . '/../push.php';
            responder(200, ['clave' => pushClaves()['publica']]);

        case 'push_suscribir':
            if ($metodo !== 'POST') responder(405, ['error' => 'Usa POST.']);
            $datos = cuerpoJson();
            $endpoint = (string) ($datos['endpoint'] ?? '');
            $p256dh = (string) ($datos['keys']['p256dh'] ?? '');
            $auth = (string) ($datos['keys']['auth'] ?? '');
            if (!endpointPushValido($endpoint) || $p256dh === '' || $auth === '') {
                responder(400, ['error' => 'Suscripción Web Push inválida.']);
            }
            $hash = hash('sha256', $endpoint);
            dbKevin($config)->prepare(
                'INSERT INTO push_nasa (endpoint_hash, endpoint, p256dh, auth)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE endpoint=VALUES(endpoint), p256dh=VALUES(p256dh), auth=VALUES(auth)'
            )->execute([$hash, $endpoint, $p256dh, $auth]);
            responder(201, ['ok' => true, 'suscripcion' => 'push_nasa']);

        case 'push_prueba':
            if ($metodo !== 'POST') responder(405, ['error' => 'Usa POST.']);
            require_once __DIR__ . '/../push.php';
            $datos = cuerpoJson();
            $endpoint = (string) ($datos['endpoint'] ?? '');
            $pdo = dbKevin($config);
            $consulta = $pdo->prepare('SELECT id, endpoint, p256dh, auth, ultimo_envio FROM push_nasa WHERE endpoint_hash = ?');
            $consulta->execute([hash('sha256', $endpoint)]);
            $suscripcion = $consulta->fetch();
            if (!$suscripcion) responder(404, ['error' => 'El dispositivo no está suscrito.']);
            if ($suscripcion['ultimo_envio'] && strtotime((string) $suscripcion['ultimo_envio']) > time() - 20) {
                responder(429, ['error' => 'Espera unos segundos antes de solicitar otra prueba.']);
            }
            $codigo = pushEnviar($suscripcion, [
                'titulo' => '☄️ NovaQuest · Radar NASA',
                'cuerpo' => 'Tu explorador está conectado. Toca para revisar los objetos cercanos a la Tierra.',
                'url' => 'explorador.html#datos',
                'tag' => 'novaquest-kevin-nasa',
            ]);
            if ($codigo === 404 || $codigo === 410) {
                $pdo->prepare('DELETE FROM push_nasa WHERE id = ?')->execute([$suscripcion['id']]);
                responder(410, ['error' => 'La suscripción venció; actívala nuevamente.']);
            }
            if ($codigo < 200 || $codigo >= 300) responder(502, ['error' => "El servicio push respondió {$codigo}."]);
            $pdo->prepare('UPDATE push_nasa SET ultimo_envio = NOW() WHERE id = ?')->execute([$suscripcion['id']]);
            responder(200, ['ok' => true, 'codigo_push' => $codigo]);

        case 'push_baja':
            if ($metodo !== 'POST') responder(405, ['error' => 'Usa POST.']);
            $endpoint = (string) (cuerpoJson()['endpoint'] ?? '');
            dbKevin($config)->prepare('DELETE FROM push_nasa WHERE endpoint_hash = ?')
                ->execute([hash('sha256', $endpoint)]);
            responder(200, ['ok' => true]);

        default:
            responder(404, ['error' => 'Ruta Kevin/NASA no encontrada.']);
    }
} catch (Throwable $error) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) $pdo->rollBack();
    error_log('NovaQuest Kevin API: ' . $error->getMessage());
    responder(500, ['error' => 'No fue posible completar la operación.', 'detalle' => $error->getMessage()]);
}
