<?php
// =====================================================================
// API de NovaQuest (PHP + PDO + MySQL)      Punto de entrada: api/index.php?r=<recurso>
//   GET  r=misiones                    lista de misiones
//   GET  r=mision&codigo=NQ-03         misión con artículo, preguntas y opciones
//   POST r=registro                    {codigo_grupo, apodo, avatar} -> token
//   POST r=responder                   {opcion_id} -> califica y suma puntos (X-Token)
//   GET  r=progreso                    progreso e insignias del niño (X-Token)
//   GET  r=ranking&codigo_grupo=DEMO01 top 10 del grupo
//   GET  r=linea_tiempo                etapas con eventos, viñetas y reto
//   POST r=etapa_progreso              {etapa_id, vinetas_vistas} (X-Token)
// =====================================================================
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function salida(int $codigo, $datos): never {
    http_response_code($codigo);
    echo json_encode($datos, JSON_UNESCAPED_UNICODE);
    exit;
}

function db(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;
    $c = require __DIR__ . '/config.php';
    $dsn = "mysql:host={$c['host']};port={$c['port']};dbname={$c['dbname']};charset={$c['charset']}";
    return $pdo = new PDO($dsn, $c['user'], $c['pass'], [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
}

function cuerpo(): array {
    $json = json_decode(file_get_contents('php://input') ?: '', true);
    return is_array($json) ? $json : [];
}

function usuarioActual(): array {
    $token = $_SERVER['HTTP_X_TOKEN'] ?? '';
    if (!preg_match('/^[a-f0-9]{64}$/', $token)) salida(401, ['error' => 'Falta el token']);
    $st = db()->prepare('SELECT id, grupo_id, apodo, avatar FROM usuarios WHERE token = ?');
    $st->execute([$token]);
    return $st->fetch() ?: salida(401, ['error' => 'Token inválido']);
}

// Otorga una insignia por su código. Devuelve true si es nueva.
function darInsignia(PDO $pdo, int $uid, string $codigo): bool {
    $st = $pdo->prepare('INSERT IGNORE INTO usuario_insignias (usuario_id, insignia_id)
                         SELECT ?, id FROM insignias WHERE codigo = ?');
    $st->execute([$uid, $codigo]);
    return $st->rowCount() > 0;
}

$recurso = $_GET['r'] ?? '';
$metodo  = $_SERVER['REQUEST_METHOD'];

try {
    switch ($recurso) {

        case 'misiones':
            salida(200, db()->query("SELECT codigo, titulo, categoria, tipo, resumen, nivel, imagen
                                     FROM misiones WHERE activa = 1 ORDER BY codigo")->fetchAll());

        case 'mision':
            $st = db()->prepare('SELECT id, codigo, titulo, categoria, tipo, resumen, nivel, imagen
                                 FROM misiones WHERE codigo = ?');
            $st->execute([$_GET['codigo'] ?? '']);
            $m = $st->fetch() ?: salida(404, ['error' => 'Misión no encontrada']);
            $arts = db()->prepare('SELECT id, titulo, contenido FROM articulos WHERE mision_id = ? ORDER BY orden');
            $arts->execute([$m['id']]);
            $m['articulos'] = $arts->fetchAll();
            foreach ($m['articulos'] as &$a) {
                $pr = db()->prepare('SELECT id, texto, puntos FROM preguntas WHERE articulo_id = ?');
                $pr->execute([$a['id']]);
                $a['preguntas'] = $pr->fetchAll();
                foreach ($a['preguntas'] as &$p) {
                    // No se envía es_correcta: el servidor es quien califica
                    $op = db()->prepare('SELECT id, texto FROM opciones WHERE pregunta_id = ?');
                    $op->execute([$p['id']]);
                    $p['opciones'] = $op->fetchAll();
                }
                unset($p);
            }
            unset($a);
            salida(200, $m);

        case 'registro':
            if ($metodo !== 'POST') salida(405, ['error' => 'Usa POST']);
            $b = cuerpo();
            $apodo  = trim((string)($b['apodo'] ?? ''));
            $avatar = preg_replace('/[^a-z_]/', '', (string)($b['avatar'] ?? 'astronauta')) ?: 'astronauta';
            if (mb_strlen($apodo) < 2 || mb_strlen($apodo) > 30) salida(422, ['error' => 'El apodo debe tener de 2 a 30 caracteres']);
            $g = db()->prepare('SELECT id FROM grupos WHERE codigo = ?');
            $g->execute([strtoupper(trim((string)($b['codigo_grupo'] ?? '')))]);
            $grupo = $g->fetch() ?: salida(404, ['error' => 'Ese código de grupo no existe']);
            $token = bin2hex(random_bytes(32));
            try {
                db()->prepare('INSERT INTO usuarios (grupo_id, apodo, avatar, token) VALUES (?,?,?,?)')
                    ->execute([$grupo['id'], $apodo, $avatar, $token]);
            } catch (PDOException $e) {
                if ($e->getCode() === '23000') salida(409, ['error' => 'Ese apodo ya existe en el grupo']);
                throw $e;
            }
            salida(201, ['token' => $token, 'apodo' => $apodo, 'avatar' => $avatar]);

        case 'responder':
            if ($metodo !== 'POST') salida(405, ['error' => 'Usa POST']);
            $u = usuarioActual();
            $opcionId = (int)(cuerpo()['opcion_id'] ?? 0);
            $st = db()->prepare('SELECT o.id, o.pregunta_id, o.es_correcta, p.puntos, p.explicacion, p.etapa_id, a.mision_id
                                 FROM opciones o
                                 JOIN preguntas p ON p.id = o.pregunta_id
                                 LEFT JOIN articulos a ON a.id = p.articulo_id
                                 WHERE o.id = ?');
            $st->execute([$opcionId]);
            $o = $st->fetch() ?: salida(404, ['error' => 'Esa opción no existe']);

            // La pregunta es de una misión (videojuego) o de una etapa (línea de tiempo)
            if ($o['mision_id'] !== null) {
                $tabla = 'progreso';          $col = 'mision_id'; $destino = (int)$o['mision_id'];
                $qTotal = 'SELECT COUNT(*) FROM preguntas p JOIN articulos a ON a.id = p.articulo_id WHERE a.mision_id = ?';
                $qAcier = 'SELECT COUNT(DISTINCT i.pregunta_id) FROM intentos i
                           JOIN preguntas p ON p.id = i.pregunta_id JOIN articulos a ON a.id = p.articulo_id
                           WHERE i.usuario_id = ? AND a.mision_id = ? AND i.correcta = 1';
            } else {
                $tabla = 'progreso_etapas';   $col = 'etapa_id';  $destino = (int)$o['etapa_id'];
                $qTotal = 'SELECT COUNT(*) FROM preguntas WHERE etapa_id = ?';
                $qAcier = 'SELECT COUNT(DISTINCT i.pregunta_id) FROM intentos i
                           JOIN preguntas p ON p.id = i.pregunta_id
                           WHERE i.usuario_id = ? AND p.etapa_id = ? AND i.correcta = 1';
            }

            $pdo = db();
            $pdo->beginTransaction();
            // ¿ya había acertado esta pregunta? (para no sumar puntos dos veces)
            $ya = $pdo->prepare('SELECT 1 FROM intentos WHERE usuario_id = ? AND pregunta_id = ? AND correcta = 1 LIMIT 1');
            $ya->execute([$u['id'], $o['pregunta_id']]);
            $yaAcerto = (bool)$ya->fetch();

            $pdo->prepare('INSERT INTO intentos (usuario_id, pregunta_id, opcion_id, correcta) VALUES (?,?,?,?)')
                ->execute([$u['id'], $o['pregunta_id'], $o['id'], (int)$o['es_correcta']]);

            $suma = ($o['es_correcta'] && !$yaAcerto) ? (int)$o['puntos'] : 0;
            // $tabla y $col son constantes definidas arriba (no vienen del usuario)
            $pdo->prepare("INSERT INTO $tabla (usuario_id, $col, estado, puntos) VALUES (?,?, 'en_curso', ?)
                           ON DUPLICATE KEY UPDATE puntos = puntos + VALUES(puntos)")
                ->execute([$u['id'], $destino, $suma]);

            $tot = $pdo->prepare($qTotal); $tot->execute([$destino]);
            $ok  = $pdo->prepare($qAcier); $ok->execute([$u['id'], $destino]);
            $total     = (int)$tot->fetchColumn();
            $acertadas = (int)$ok->fetchColumn();
            $completada = $total > 0 && $acertadas >= $total;
            $insignias = [];
            if ($completada) {
                $pdo->prepare("UPDATE $tabla SET estado = 'completada' WHERE usuario_id = ? AND $col = ?")
                    ->execute([$u['id'], $destino]);
                if ($tabla === 'progreso') {
                    if (darInsignia($pdo, (int)$u['id'], 'primera_mision')) $insignias[] = 'primera_mision';
                    $n = $pdo->prepare("SELECT COUNT(*) FROM progreso WHERE usuario_id = ? AND estado = 'completada'");
                    $n->execute([$u['id']]);
                    if ((int)$n->fetchColumn() >= 3 && darInsignia($pdo, (int)$u['id'], 'explorador')) $insignias[] = 'explorador';
                }
            }
            $pdo->commit();
            salida(200, ['correcta' => (bool)$o['es_correcta'], 'puntos_ganados' => $suma,
                         'completada' => $completada, 'insignias_nuevas' => $insignias,
                         // El dato curioso solo se revela al acertar (no delata la respuesta)
                         'explicacion' => $o['es_correcta'] ? $o['explicacion'] : null]);

        case 'progreso':
            $u = usuarioActual();
            $m = db()->prepare('SELECT m.codigo, p.estado, p.puntos FROM progreso p
                                JOIN misiones m ON m.id = p.mision_id WHERE p.usuario_id = ?');
            $m->execute([$u['id']]);
            $e = db()->prepare('SELECT e.nombre, p.estado, p.vinetas_vistas, p.puntos FROM progreso_etapas p
                                JOIN etapas e ON e.id = p.etapa_id WHERE p.usuario_id = ?');
            $e->execute([$u['id']]);
            $i = db()->prepare('SELECT i.codigo, i.nombre FROM usuario_insignias ui
                                JOIN insignias i ON i.id = ui.insignia_id WHERE ui.usuario_id = ?');
            $i->execute([$u['id']]);
            salida(200, ['usuario' => $u['apodo'], 'misiones' => $m->fetchAll(),
                         'etapas' => $e->fetchAll(), 'insignias' => $i->fetchAll()]);

        case 'ranking':
            $st = db()->prepare('SELECT u.apodo, u.avatar,
                    COALESCE((SELECT SUM(puntos) FROM progreso WHERE usuario_id = u.id), 0)
                  + COALESCE((SELECT SUM(puntos) FROM progreso_etapas WHERE usuario_id = u.id), 0) AS puntos
                 FROM usuarios u JOIN grupos g ON g.id = u.grupo_id
                 WHERE g.codigo = ? ORDER BY puntos DESC LIMIT 10');
            $st->execute([strtoupper((string)($_GET['codigo_grupo'] ?? ''))]);
            salida(200, $st->fetchAll());

        case 'linea_tiempo':
            $pdo = db();
            $etapas    = $pdo->query('SELECT id, nombre, descripcion FROM etapas ORDER BY orden')->fetchAll();
            $eventos   = $pdo->query('SELECT id, etapa_id, hace_millones, titulo, texto, icono
                                      FROM eventos_linea_tiempo ORDER BY orden')->fetchAll();
            $vinetas   = $pdo->query('SELECT evento_id, dialogo, escena FROM vinetas ORDER BY evento_id, orden')->fetchAll();
            $preguntas = $pdo->query('SELECT id, etapa_id, texto, puntos FROM preguntas
                                      WHERE etapa_id IS NOT NULL ORDER BY id')->fetchAll();
            $opciones  = $pdo->query('SELECT o.id, o.pregunta_id, o.texto FROM opciones o
                                      JOIN preguntas p ON p.id = o.pregunta_id
                                      WHERE p.etapa_id IS NOT NULL ORDER BY o.id')->fetchAll();
            // Se arma el árbol: etapa > eventos > viñetas, y etapa > reto > opciones.
            // (no se envía es_correcta: el servidor califica)
            $vinPorEvento = [];
            foreach ($vinetas as $v) $vinPorEvento[(int)$v['evento_id']][] = ['dialogo' => $v['dialogo'], 'escena' => $v['escena']];
            $opPorPregunta = [];
            foreach ($opciones as $o) $opPorPregunta[(int)$o['pregunta_id']][] = ['id' => (int)$o['id'], 'texto' => $o['texto']];
            $retoPorEtapa = [];
            foreach ($preguntas as $p) {
                $retoPorEtapa[(int)$p['etapa_id']][] = ['id' => (int)$p['id'], 'texto' => $p['texto'],
                    'puntos' => (int)$p['puntos'], 'opciones' => $opPorPregunta[(int)$p['id']] ?? []];
            }
            $salida = [];
            foreach ($etapas as $e) {
                $eid = (int)$e['id'];
                $evs = [];
                foreach ($eventos as $ev) {
                    if ((int)$ev['etapa_id'] !== $eid) continue;
                    $evs[] = ['id' => (int)$ev['id'], 'hace_millones' => (float)$ev['hace_millones'],
                              'titulo' => $ev['titulo'], 'texto' => $ev['texto'], 'icono' => $ev['icono'],
                              'vinetas' => $vinPorEvento[(int)$ev['id']] ?? []];
                }
                $salida[] = ['id' => $eid, 'nombre' => $e['nombre'], 'descripcion' => $e['descripcion'],
                             'eventos' => $evs, 'reto' => $retoPorEtapa[$eid] ?? []];
            }
            salida(200, $salida);

        case 'etapa_progreso':
            if ($metodo !== 'POST') salida(405, ['error' => 'Usa POST']);
            $u = usuarioActual();
            $b = cuerpo();
            $etapaId = (int)($b['etapa_id'] ?? 0);
            $vistas  = max(0, min(255, (int)($b['vinetas_vistas'] ?? 0)));
            $ex = db()->prepare('SELECT 1 FROM etapas WHERE id = ?');
            $ex->execute([$etapaId]);
            if (!$ex->fetch()) salida(404, ['error' => 'Esa etapa no existe']);
            db()->prepare("INSERT INTO progreso_etapas (usuario_id, etapa_id, estado, vinetas_vistas) VALUES (?,?, 'en_curso', ?)
                           ON DUPLICATE KEY UPDATE vinetas_vistas = GREATEST(vinetas_vistas, VALUES(vinetas_vistas))")
                ->execute([$u['id'], $etapaId, $vistas]);
            salida(200, ['ok' => true]);

        default:
            salida(404, ['error' => 'Recurso desconocido']);
    }
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log('NovaQuest API: ' . $e->getMessage());
    salida(500, ['error' => 'Error interno del servidor']);
}
