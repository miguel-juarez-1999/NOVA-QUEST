-- =====================================================================
-- APORTACIÓN KEVIN: migración aditiva para NQ Orbit Explorer
-- Compatible con MySQL 5.7 / MariaDB. No modifica tablas del juego.
-- =====================================================================

START TRANSACTION;

-- Catálogo normalizado de objetos recibidos desde NASA NeoWs.
CREATE TABLE IF NOT EXISTS `objetos_nasa` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `nasa_id` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nombre` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tipo` enum('asteroide','cometa','otro') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'asteroide',
  `magnitud_absoluta` decimal(8,3) DEFAULT NULL,
  `diametro_min_m` decimal(18,2) DEFAULT NULL,
  `diametro_max_m` decimal(18,2) DEFAULT NULL,
  `potencialmente_peligroso` tinyint(1) NOT NULL DEFAULT '0',
  `url_jpl` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `datos_json` json DEFAULT NULL,
  `consultado_en` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_objetos_nasa_nasa_id` (`nasa_id`),
  KEY `idx_objetos_nasa_peligroso` (`potencialmente_peligroso`),
  KEY `idx_objetos_nasa_actualizado` (`actualizado_en`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Un objeto puede tener muchas aproximaciones a la Tierra en fechas distintas.
CREATE TABLE IF NOT EXISTS `aproximaciones_nasa` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `objeto_nasa_id` bigint(20) UNSIGNED NOT NULL,
  `fecha_aproximacion` datetime NOT NULL,
  `cuerpo_orbitado` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Earth',
  `velocidad_kmh` decimal(18,2) DEFAULT NULL,
  `distancia_km` decimal(20,2) DEFAULT NULL,
  `distancia_lunar` decimal(18,6) DEFAULT NULL,
  `datos_json` json DEFAULT NULL,
  `creado_en` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_aproximacion_objeto_fecha_cuerpo` (`objeto_nasa_id`,`fecha_aproximacion`,`cuerpo_orbitado`),
  KEY `idx_aproximaciones_fecha` (`fecha_aproximacion`),
  CONSTRAINT `fk_aproximacion_objeto_nasa`
    FOREIGN KEY (`objeto_nasa_id`) REFERENCES `objetos_nasa` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

COMMIT;

-- La tabla existente `cache_api` se reutilizará desde el backend para guardar
-- respuestas temporales. No se duplica porque ya contiene clave, respuesta y
-- fecha de expiración.
