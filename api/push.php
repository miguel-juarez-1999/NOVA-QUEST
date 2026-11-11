<?php
// =====================================================================
// Notificaciones push (Web Push) sin librerías externas.
//   - VAPID (RFC 8292): identifica a nuestro servidor ante el servicio push
//     del navegador con un JWT firmado (ES256).
//   - Cifrado aes128gcm (RFC 8291): el mensaje viaja cifrado; solo el
//     navegador del niño puede leerlo.
// Las claves VAPID se generan solas la primera vez y se guardan en
// api/push-claves.local.php (no se sube a git).
// =====================================================================
declare(strict_types=1);
require_once __DIR__ . '/db.php';

const PUSH_CONTACTO = 'mailto:novaquest@example.com';
// Cabecera DER de una clave pública P-256 (SubjectPublicKeyInfo)
const PUSH_DER_P256 = '3059301306072a8648ce3d020106082a8648ce3d030107034200';

function b64u(string $bin): string {
    return rtrim(strtr(base64_encode($bin), '+/', '-_'), '=');
}

function b64uDecode(string $txt): string {
    $bin = base64_decode(strtr($txt, '-_', '+/'), true);
    if ($bin === false) throw new InvalidArgumentException('Base64 inválido');
    return $bin;
}

// En Windows/MAMP PHP no encuentra openssl.cnf por sí solo
function pushOpenssl(): array {
    return ['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC,
            'config' => __DIR__ . '/openssl.cnf'];
}

// Clave pública sin comprimir (0x04 || X || Y, 65 bytes)
function pushPublicaCruda($clave): string {
    $ec = openssl_pkey_get_details($clave)['ec'];
    return "\x04" . str_pad($ec['x'], 32, "\0", STR_PAD_LEFT) . str_pad($ec['y'], 32, "\0", STR_PAD_LEFT);
}

function pushPublicaDesdeCruda(string $cruda) {
    $pem = "-----BEGIN PUBLIC KEY-----\n"
         . chunk_split(base64_encode(hex2bin(PUSH_DER_P256) . $cruda), 64, "\n")
         . "-----END PUBLIC KEY-----\n";
    $clave = openssl_pkey_get_public($pem);
    if (!$clave) throw new InvalidArgumentException('Clave del navegador inválida');
    return $clave;
}

function pushClaves(): array {
    $archivo = __DIR__ . '/push-claves.local.php';
    if (is_file($archivo)) return require $archivo;
    $cfg = pushOpenssl();
    $privada = openssl_pkey_new($cfg);
    if (!$privada || !openssl_pkey_export($privada, $pem, null, $cfg)) {
        throw new RuntimeException('No se pudieron generar las claves VAPID');
    }
    $claves = ['publica' => b64u(pushPublicaCruda($privada)), 'privada_pem' => $pem];
    file_put_contents($archivo, "<?php\n// Claves VAPID generadas automáticamente. No compartir.\nreturn "
        . var_export($claves, true) . ";\n", LOCK_EX);
    return $claves;
}

// openssl_sign entrega la firma en DER; JWT necesita R || S (64 bytes)
function pushFirmaCruda(string $der): string {
    $pos = 3;
    $lenR = ord($der[$pos]);
    $r = substr($der, $pos + 1, $lenR);
    $pos += 1 + $lenR + 1;
    $s = substr($der, $pos + 1, ord($der[$pos]));
    $fija = fn(string $n) => str_pad(ltrim($n, "\0"), 32, "\0", STR_PAD_LEFT);
    return $fija($r) . $fija($s);
}

function pushVapid(string $endpoint, array $claves): string {
    $u = parse_url($endpoint);
    $aud = $u['scheme'] . '://' . $u['host'] . (isset($u['port']) ? ':' . $u['port'] : '');
    $datos = b64u(json_encode(['typ' => 'JWT', 'alg' => 'ES256'])) . '.'
           . b64u(json_encode(['aud' => $aud, 'exp' => time() + 12 * 3600, 'sub' => PUSH_CONTACTO]));
    openssl_sign($datos, $firma, openssl_pkey_get_private($claves['privada_pem']), OPENSSL_ALGO_SHA256);
    return 'vapid t=' . $datos . '.' . b64u(pushFirmaCruda($firma)) . ', k=' . $claves['publica'];
}

// Cifra el mensaje para un navegador (RFC 8291, un solo registro)
function pushCifrar(string $mensaje, string $p256dh, string $auth): string {
    $uaPublica = b64uDecode($p256dh);
    $secreto   = b64uDecode($auth);
    $temporal  = openssl_pkey_new(pushOpenssl());
    $asPublica = pushPublicaCruda($temporal);
    $ecdh = openssl_pkey_derive(pushPublicaDesdeCruda($uaPublica), $temporal, 32);
    if ($ecdh === false) throw new RuntimeException('Falló el intercambio de claves');

    $ikm   = hash_hkdf('sha256', $ecdh, 32, "WebPush: info\0" . $uaPublica . $asPublica, $secreto);
    $sal   = random_bytes(16);
    $cek   = hash_hkdf('sha256', $ikm, 16, "Content-Encoding: aes128gcm\0", $sal);
    $nonce = hash_hkdf('sha256', $ikm, 12, "Content-Encoding: nonce\0", $sal);
    // 0x02 marca el último (y único) registro
    $cifrado = openssl_encrypt($mensaje . "\x02", 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, $tag);
    return $sal . pack('N', 4096) . chr(strlen($asPublica)) . $asPublica . $cifrado . $tag;
}

// Envía un aviso. $datos = ['titulo', 'cuerpo', 'url']. Devuelve el código
// HTTP del servicio push (201 = entregado; 404/410 = suscripción vencida).
function pushEnviar(array $sub, array $datos): int {
    $claves = pushClaves();
    $cuerpo = pushCifrar(json_encode($datos, JSON_UNESCAPED_UNICODE), $sub['p256dh'], $sub['auth']);
    $c = curl_init($sub['endpoint']);
    curl_setopt_array($c, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $cuerpo,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 15,
        // Usa los certificados de Windows (MAMP no trae los suyos)
        CURLOPT_SSL_OPTIONS    => defined('CURLSSLOPT_NATIVE_CA') ? CURLSSLOPT_NATIVE_CA : 0,
        CURLOPT_HTTPHEADER     => [
            'Authorization: ' . pushVapid($sub['endpoint'], $claves),
            'Content-Encoding: aes128gcm',
            'Content-Type: application/octet-stream',
            'TTL: 86400',
            'Urgency: normal',
        ],
    ]);
    curl_exec($c);
    $codigo = (int)curl_getinfo($c, CURLINFO_HTTP_CODE);
    if ($codigo === 0) error_log('NovaQuest push: ' . curl_error($c));
    curl_close($c);
    return $codigo;
}

// Un dato curioso al azar de la línea de tiempo, listo para enviarse
function pushDatoCurioso(PDO $pdo): array {
    $ev = $pdo->query('SELECT id, titulo, texto FROM eventos_linea_tiempo ORDER BY ' . sqlAzar($pdo) . ' LIMIT 1')->fetch();
    if (!$ev) return ['titulo' => '🚀 NovaQuest', 'cuerpo' => '¡Tu viaje en el tiempo te espera!', 'url' => 'linea-tiempo.html'];
    return ['titulo' => '⏳ ¿Sabías que...? ' . $ev['titulo'], 'cuerpo' => $ev['texto'],
            'url' => 'linea-tiempo.html#momento-' . $ev['id']];
}
