-- =====================================================================
-- APORTACIÓN KEVIN: suscripciones push exclusivas de NQ Orbit Explorer
-- Compatible con MySQL 5.7 / MariaDB. No modifica push_juego ni
-- push_suscripciones, que pertenecen a otros módulos del equipo.
-- Se puede ejecutar más de una vez sin duplicar la tabla.
-- =====================================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `push_nasa` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `usuario_id` int(10) UNSIGNED DEFAULT NULL,
  `endpoint_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `endpoint` varchar(600) COLLATE utf8mb4_unicode_ci NOT NULL,
  `p256dh` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `auth` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `creado_en` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ultimo_envio` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_push_nasa_endpoint` (`endpoint_hash`),
  KEY `idx_push_nasa_usuario` (`usuario_id`),
  CONSTRAINT `fk_push_nasa_usuario`
    FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
