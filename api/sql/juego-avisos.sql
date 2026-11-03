-- =====================================================================
-- NovaQuest · Avisos push del videojuego (Cadetes NovaQuest)
-- Tabla propia del juego: no se mezcla con push_suscripciones (línea del
-- tiempo). Cada fila es un navegador de un cadete con sesión.
--
-- Se puede ejecutar más de una vez: no duplica nada.
--   mysql -h127.0.0.1 -P3306 -uroot -proot --default-character-set=utf8mb4 novaquest < api/sql/juego-avisos.sql
-- =====================================================================
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS push_juego (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id     INT UNSIGNED NOT NULL,
  endpoint_hash  CHAR(64)     NOT NULL,
  endpoint       VARCHAR(600) NOT NULL,
  p256dh         VARCHAR(120) NOT NULL,
  auth           VARCHAR(40)  NOT NULL,
  creado_en      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultimo_envio   TIMESTAMP    NULL DEFAULT NULL,
  ultimo_ranking TIMESTAMP    NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pj_endpoint (endpoint_hash),
  KEY fk_pj_user (usuario_id),
  CONSTRAINT fk_pj_user FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
