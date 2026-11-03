-- =====================================================================
-- NovaQuest · Viaje en el tiempo v2
-- Agrega momentos nuevos a la historia de la Tierra, más viñetas, un reto
-- por etapa, la insignia "Viajero del tiempo" y la tabla de suscripciones
-- para las notificaciones push.
--
-- Se puede ejecutar más de una vez: no duplica nada.
--   mysql -h127.0.0.1 -P3307 -uroot -proot --default-character-set=utf8mb4 novaquest < api/sql/linea-tiempo-v2.sql
-- =====================================================================
SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- 1. Suscripciones push (una por navegador)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS push_suscripciones (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id    INT UNSIGNED NULL,
  endpoint_hash CHAR(64)     NOT NULL,
  endpoint      VARCHAR(600) NOT NULL,
  p256dh        VARCHAR(120) NOT NULL,
  auth          VARCHAR(40)  NOT NULL,
  creado_en     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultimo_envio  TIMESTAMP    NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_push_endpoint (endpoint_hash),
  KEY fk_push_user (usuario_id),
  CONSTRAINT fk_push_user FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 2. Insignia por terminar todas las etapas
-- ---------------------------------------------------------------------
INSERT IGNORE INTO insignias (codigo, nombre, descripcion)
VALUES ('viajero_tiempo', 'Viajero del tiempo', 'Resolviste los retos de todas las etapas de la Tierra');

-- ---------------------------------------------------------------------
-- 3. Momentos nuevos de la historia
--    (etapa_id: 1 Hadeico, 2 Arcaico, 3 Paleozoico, 4 Mesozoico, 5 Cenozoico)
-- ---------------------------------------------------------------------
INSERT INTO eventos_linea_tiempo (etapa_id, hace_millones, titulo, texto, icono, orden)
SELECT * FROM (
  SELECT 1 AS e, 4400 AS h, 'Llueve sin parar' AS t,
         'La Tierra se enfrió, el vapor de los volcanes formó nubes y llovió durante millones de años. Así nacieron los océanos.' AS x,
         'lluvia' AS i, 3 AS o
  UNION ALL SELECT 2, 3500, 'Fábricas de oxígeno',
         'Unos microbios llamados cianobacterias usaron la luz del Sol para vivir y llenaron el aire de oxígeno.', 'oxigeno', 5
  UNION ALL SELECT 3, 470, 'Las plantas salen del agua',
         'Las primeras plantas, pequeñas como el musgo, salieron del mar y cubrieron de verde las rocas.', 'planta', 7
  UNION ALL SELECT 3, 375, 'Peces con patas',
         'Algunos peces tenían aletas fuertes como patitas. Con ellas salieron del agua: fueron los abuelos de los anfibios.', 'anfibio', 8
  UNION ALL SELECT 4, 200, 'Pangea se rompe',
         'Todos los continentes estaban unidos en uno solo llamado Pangea. Poco a poco se separaron hasta quedar como hoy.', 'pangea', 10
  UNION ALL SELECT 4, 150, 'Aparecen las aves',
         'Algunos dinosaurios pequeños tenían plumas. De ellos vienen todas las aves que ves hoy.', 'ave', 11
  UNION ALL SELECT 5, 2.5, 'Llega la Edad de Hielo',
         'El planeta se enfrió mucho. Grandes capas de hielo cubrieron la Tierra y vivían mamuts peludos.', 'mamut', 13
  UNION ALL SELECT 5, 0, 'Hoy: tú cuidas la Tierra',
         'Después de 4,600 millones de años llegamos a hoy. Ahora nos toca cuidar el planeta que tardó tanto en formarse.', 'hoy', 15
) nuevos
WHERE NOT EXISTS (SELECT 1 FROM eventos_linea_tiempo ev WHERE ev.titulo = nuevos.t);

-- Reordena todos los momentos de más antiguo a más reciente
UPDATE eventos_linea_tiempo SET orden = 1  WHERE titulo = 'Nace la Tierra';
UPDATE eventos_linea_tiempo SET orden = 2  WHERE titulo = 'Nace la Luna';
UPDATE eventos_linea_tiempo SET orden = 3  WHERE titulo = 'Llueve sin parar';
UPDATE eventos_linea_tiempo SET orden = 4  WHERE titulo = 'Aparece la vida';
UPDATE eventos_linea_tiempo SET orden = 5  WHERE titulo = 'Fábricas de oxígeno';
UPDATE eventos_linea_tiempo SET orden = 6  WHERE titulo = 'Explosión de vida';
UPDATE eventos_linea_tiempo SET orden = 7  WHERE titulo = 'Las plantas salen del agua';
UPDATE eventos_linea_tiempo SET orden = 8  WHERE titulo = 'Peces con patas';
UPDATE eventos_linea_tiempo SET orden = 9  WHERE titulo = 'Era de los dinosaurios';
UPDATE eventos_linea_tiempo SET orden = 10 WHERE titulo = 'Pangea se rompe';
UPDATE eventos_linea_tiempo SET orden = 11 WHERE titulo = 'Aparecen las aves';
UPDATE eventos_linea_tiempo SET orden = 12 WHERE titulo = 'Cae un asteroide';
UPDATE eventos_linea_tiempo SET orden = 13 WHERE titulo = 'Llega la Edad de Hielo';
UPDATE eventos_linea_tiempo SET orden = 14 WHERE titulo = 'Aparece el ser humano';
UPDATE eventos_linea_tiempo SET orden = 15 WHERE titulo = 'Hoy: tú cuidas la Tierra';

-- ---------------------------------------------------------------------
-- 4. Viñetas (diálogos de la historieta)
--    Se insertan por título del momento + número de viñeta.
-- ---------------------------------------------------------------------
INSERT INTO vinetas (evento_id, orden, dialogo, escena)
SELECT ev.id, n.o, n.d, n.s
FROM (
  -- Viñetas extra para los momentos que ya existían
  SELECT 'Nace la Luna' AS t, 3 AS o, 'Al principio la Luna estaba mucho más cerca. ¡Se veía enorme en el cielo!' AS d, 'luna' AS s
  UNION ALL SELECT 'Aparece la vida', 3, '¡Todos los seres vivos, incluido tú, venimos de esos seres diminutos!', 'microbio'
  UNION ALL SELECT 'Explosión de vida', 3, 'El más famoso era el trilobite: parecía una cochinilla gigante y tenía ojos de cristal.', 'mar'
  UNION ALL SELECT 'Era de los dinosaurios', 3, 'Dato loco: el T. rex vivió más cerca de nosotros que del estegosaurio.', 'dinos'
  UNION ALL SELECT 'Cae un asteroide', 3, 'Los dinosaurios grandes desaparecieron... pero sus parientes con plumas sobrevivieron.', 'asteroide'
  UNION ALL SELECT 'Aparece el ser humano', 3, 'Aprendimos a usar el fuego, a hablar y a pintar en las paredes de las cuevas.', 'humano'
  -- Momentos nuevos
  UNION ALL SELECT 'Llueve sin parar', 1, 'La Tierra se fue enfriando y el vapor de los volcanes formó nubes gigantes.', 'lava'
  UNION ALL SELECT 'Llueve sin parar', 2, '¡Empezó a llover... y no paró durante millones de años!', 'lluvia'
  UNION ALL SELECT 'Llueve sin parar', 3, 'Toda esa agua llenó los huecos del planeta. ¡Así nacieron los océanos!', 'oceano'
  UNION ALL SELECT 'Fábricas de oxígeno', 1, 'Unos microbios llamados cianobacterias aprendieron a comer luz del Sol.', 'oxigeno'
  UNION ALL SELECT 'Fábricas de oxígeno', 2, 'Al hacerlo soltaban burbujitas de oxígeno: ¡el aire que hoy respiras!', 'oxigeno'
  UNION ALL SELECT 'Fábricas de oxígeno', 3, 'Vivían en montoncitos de roca llamados estromatolitos. ¡Todavía hay en la laguna de Bacalar, en México!', 'oceano'
  UNION ALL SELECT 'Las plantas salen del agua', 1, 'Mira esas rocas: antes estaban peladas, sin nada verde.', 'plantas'
  UNION ALL SELECT 'Las plantas salen del agua', 2, 'Las primeras plantas eran chiquitas como el musgo, pero cubrieron todo de verde.', 'plantas'
  UNION ALL SELECT 'Peces con patas', 1, 'Este pez tiene aletas fuertes, ¡casi como patitas!', 'anfibio'
  UNION ALL SELECT 'Peces con patas', 2, 'Con ellas salió a la orilla. De peces así vienen las ranas, los lagartos... ¡y nosotros!', 'anfibio'
  UNION ALL SELECT 'Pangea se rompe', 1, 'Antes todos los continentes estaban pegados en uno solo: Pangea.', 'pangea'
  UNION ALL SELECT 'Pangea se rompe', 2, 'Se fueron separando muy despacito, lo que crecen tus uñas cada año.', 'pangea'
  UNION ALL SELECT 'Aparecen las aves', 1, '¿Ves esas plumas? Algunos dinosaurios pequeños ya las tenían.', 'aves'
  UNION ALL SELECT 'Aparecen las aves', 2, 'De ellos vienen las aves. ¡Una gallina es pariente del T. rex!', 'aves'
  UNION ALL SELECT 'Llega la Edad de Hielo', 1, '¡Brrr! El planeta se enfrió y el hielo cubrió montañas y llanuras.', 'hielo'
  UNION ALL SELECT 'Llega la Edad de Hielo', 2, 'Los mamuts tenían pelo largo y grasa para no congelarse.', 'hielo'
  UNION ALL SELECT 'Hoy: tú cuidas la Tierra', 1, 'Llegamos a hoy. ¡Gracias por viajar conmigo, cadete!', 'hoy'
  UNION ALL SELECT 'Hoy: tú cuidas la Tierra', 2, 'La Tierra tardó 4,600 millones de años en ser así. Cuidar el agua, las plantas y los animales es nuestra misión.', 'hoy'
) n
JOIN eventos_linea_tiempo ev ON ev.titulo = n.t
WHERE NOT EXISTS (SELECT 1 FROM vinetas v WHERE v.evento_id = ev.id AND v.orden = n.o);

-- ---------------------------------------------------------------------
-- 5. Retos (preguntas por etapa). La primera opción de cada una es la
--    correcta; la página las revuelve al mostrarlas.
-- ---------------------------------------------------------------------
INSERT INTO preguntas (etapa_id, texto, puntos, explicacion)
SELECT * FROM (
  SELECT 1 AS e, '¿Cómo se formó la Luna?' AS t, 10 AS p,
         'Los científicos llaman Theia al planeta que chocó con la Tierra. ¡Era del tamaño de Marte!' AS x
  UNION ALL SELECT 1, '¿De dónde salió el agua de los océanos?', 10,
         'El vapor de los volcanes formó nubes y llovió millones de años. Algunos cometas también trajeron hielo.'
  UNION ALL SELECT 2, '¿Cómo eran los primeros seres vivos?', 10,
         'Eran más pequeños que un grano de sal. Necesitarías un microscopio para verlos.'
  UNION ALL SELECT 2, '¿Qué regalaron las cianobacterias al planeta?', 10,
         'Gracias a ellas hay oxígeno en el aire. Puedes ver estromatolitos vivos en la laguna de Bacalar, Quintana Roo.'
  UNION ALL SELECT 3, '¿Qué tenían algunos animales del Paleozoico para protegerse?', 10,
         'Los trilobites tenían un caparazón duro, ¡y sus ojos estaban hechos de cristal de roca!'
  UNION ALL SELECT 3, '¿Quiénes salieron primero del agua a vivir en tierra firme?', 10,
         'Primero llegaron las plantas; después los insectos y luego los peces con patas.'
  UNION ALL SELECT 4, '¿Qué animales de hoy son parientes de los dinosaurios?', 10,
         '¡Las gallinas y las palomas son dinosaurios pequeñitos con plumas!'
  UNION ALL SELECT 5, '¿Dónde aparecieron los primeros seres humanos?', 10,
         'Desde África, nuestros antepasados caminaron y poco a poco llegaron a todos los continentes.'
  UNION ALL SELECT 5, 'Si la historia de la Tierra fuera un día de 24 horas, ¿cuánto llevamos los humanos?', 10,
         'Aparecimos a las 23:59:54. ¡Solo 6 segundos antes de la medianoche!'
) nuevas
WHERE NOT EXISTS (SELECT 1 FROM preguntas pr WHERE pr.texto = nuevas.t);

INSERT INTO opciones (pregunta_id, texto, es_correcta)
SELECT pr.id, n.o, n.c
FROM (
  SELECT '¿Cómo se formó la Luna?' AS t, 'Un choque gigante lanzó pedazos de la Tierra al espacio' AS o, 1 AS c
  UNION ALL SELECT '¿Cómo se formó la Luna?', 'Se desprendió del Sol', 0
  UNION ALL SELECT '¿Cómo se formó la Luna?', 'La construyeron los extraterrestres', 0
  UNION ALL SELECT '¿De dónde salió el agua de los océanos?', 'Llovió durante millones de años', 1
  UNION ALL SELECT '¿De dónde salió el agua de los océanos?', 'La trajeron los dinosaurios', 0
  UNION ALL SELECT '¿De dónde salió el agua de los océanos?', 'Se derritió el Sol', 0
  UNION ALL SELECT '¿Cómo eran los primeros seres vivos?', 'Diminutos y de una sola célula', 1
  UNION ALL SELECT '¿Cómo eran los primeros seres vivos?', 'Dinosaurios gigantes', 0
  UNION ALL SELECT '¿Cómo eran los primeros seres vivos?', 'Peces de colores', 0
  UNION ALL SELECT '¿Qué regalaron las cianobacterias al planeta?', 'Oxígeno para respirar', 1
  UNION ALL SELECT '¿Qué regalaron las cianobacterias al planeta?', 'Lava caliente', 0
  UNION ALL SELECT '¿Qué regalaron las cianobacterias al planeta?', 'Montañas de oro', 0
  UNION ALL SELECT '¿Qué tenían algunos animales del Paleozoico para protegerse?', 'Un caparazón duro', 1
  UNION ALL SELECT '¿Qué tenían algunos animales del Paleozoico para protegerse?', 'Un paraguas', 0
  UNION ALL SELECT '¿Qué tenían algunos animales del Paleozoico para protegerse?', 'Alas de mariposa', 0
  UNION ALL SELECT '¿Quiénes salieron primero del agua a vivir en tierra firme?', 'Las plantas', 1
  UNION ALL SELECT '¿Quiénes salieron primero del agua a vivir en tierra firme?', 'Los dinosaurios', 0
  UNION ALL SELECT '¿Quiénes salieron primero del agua a vivir en tierra firme?', 'Los seres humanos', 0
  UNION ALL SELECT '¿Qué animales de hoy son parientes de los dinosaurios?', 'Las aves', 1
  UNION ALL SELECT '¿Qué animales de hoy son parientes de los dinosaurios?', 'Los gatos', 0
  UNION ALL SELECT '¿Qué animales de hoy son parientes de los dinosaurios?', 'Las mariposas', 0
  UNION ALL SELECT '¿Dónde aparecieron los primeros seres humanos?', 'En África', 1
  UNION ALL SELECT '¿Dónde aparecieron los primeros seres humanos?', 'En la Antártida', 0
  UNION ALL SELECT '¿Dónde aparecieron los primeros seres humanos?', 'En la Luna', 0
  UNION ALL SELECT 'Si la historia de la Tierra fuera un día de 24 horas, ¿cuánto llevamos los humanos?', 'Apenas unos segundos', 1
  UNION ALL SELECT 'Si la historia de la Tierra fuera un día de 24 horas, ¿cuánto llevamos los humanos?', 'Medio día', 0
  UNION ALL SELECT 'Si la historia de la Tierra fuera un día de 24 horas, ¿cuánto llevamos los humanos?', 'Todo el día completo', 0
) n
JOIN preguntas pr ON pr.texto = n.t
WHERE NOT EXISTS (SELECT 1 FROM opciones op WHERE op.pregunta_id = pr.id AND op.texto = n.o);
