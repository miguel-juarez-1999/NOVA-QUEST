-- =====================================================================
-- NovaQuest · Contenido de las misiones del videojuego v2
-- Una lectura tipo artículo para cada una de las 6 misiones y 4 preguntas
-- para las que no tenían (NQ-01, NQ-02, NQ-04, NQ-05 y NQ-06).
--
-- Formato de las lecturas (lo dibuja js/juego/juego.js):
--   ## Subtítulo      - elemento de lista      > recuadro "¿Sabías que...?"
--   **negritas**      una línea en blanco separa los párrafos
--
-- Se puede ejecutar más de una vez: no duplica nada y deja las lecturas al día.
--   mysql -h127.0.0.1 -P3307 -uroot -proot --default-character-set=utf8mb4 novaquest < api/sql/juego-misiones-v2.sql
-- =====================================================================
SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- 1. Lecturas: se crea la de cada misión que no tenga y luego se pone el
--    artículo completo (también reemplaza la lectura corta de NQ-03)
-- ---------------------------------------------------------------------
INSERT INTO articulos (mision_id, titulo, contenido, orden)
SELECT m.id, '', '', 1
FROM misiones m
WHERE m.codigo IN ('NQ-01', 'NQ-02', 'NQ-03', 'NQ-04', 'NQ-05', 'NQ-06')
  AND NOT EXISTS (SELECT 1 FROM articulos a WHERE a.mision_id = m.id);

UPDATE articulos a JOIN misiones m ON m.id = a.mision_id AND a.orden = 1
JOIN (
  SELECT 'NQ-01' AS m, 'Nuestra canica azul' AS t,
'Imagina que viajas en un cohete y te asomas por la ventana. Allá abajo, flotando en la oscuridad, aparece una esfera azul con remolinos blancos. ¡Es tu casa! Muchos astronautas dicen que es lo más bonito que han visto en su vida.

## ¿Por qué se ve azul?
Porque la Tierra está cubierta de agua. Los océanos ocupan casi **tres cuartas partes** del planeta: de cada 100 pedacitos de superficie, unos 71 son mar. Los continentes, donde vivimos, son como islas grandes en medio de tanta agua.

## Los remolinos blancos
Esas manchas blancas que giran son **nubes**. Desde el espacio se ven enormes: a veces un huracán completo parece un remolino del tamaño de un país. Los científicos las observan desde arriba para saber qué clima viene.

> ¿Sabías que...? Si la Tierra fuera una manzana, la capa de aire que la rodea sería tan delgada como su cáscara.

## Una capa que nos protege
Alrededor del planeta hay una capa de aire llamada **atmósfera**. Gracias a ella podemos respirar, nos protege de los rayos más fuertes del Sol y hace que el cielo se vea azul de día. Desde el espacio se ve como una línea azul brillante en el borde de la Tierra.

## Día y noche
La Tierra no está quieta: gira sobre sí misma como un trompo. Tarda unas **24 horas** en dar una vuelta completa, y por eso existen el día y la noche:
- La mitad que mira hacia el Sol tiene día.
- La otra mitad tiene noche.
- Mientras tú duermes, en el otro lado del mundo otros niños van a la escuela.

De noche, los astronautas ven brillar las luces de las ciudades como si alguien hubiera regado diamantes sobre el planeta. Ahora que conoces tu canica azul, ¡es hora de despegar!' AS c

  UNION ALL SELECT 'NQ-02', 'Una vecina que cambia de forma',
'Cuando miras al cielo de noche, la Luna es lo más grande y brillante que ves. Es nuestra vecina más cercana en el espacio y nos acompaña desde hace miles de millones de años.

## Un espejo en el cielo
La Luna es el **satélite natural** de la Tierra: da vueltas a nuestro alrededor a unos 384,000 kilómetros. Pero tiene un secreto: **no tiene luz propia**. Brilla porque refleja la luz del Sol, como un espejo. En realidad su suelo es gris oscuro, ¡casi del color del asfalto de la calle!

## ¿Por qué cambia de forma?
La Luna no cambia de verdad; lo que cambia es cuánto de su lado iluminado alcanzamos a ver. A eso le llamamos **fases**:
- **Luna nueva:** casi no se ve.
- **Cuarto creciente:** aparece una parte iluminada que crece noche tras noche.
- **Luna llena:** se ve como un círculo completo.
- **Cuarto menguante:** la parte iluminada se hace cada vez más pequeña.

Todo el ciclo dura unos **29 días y medio**. Por eso muchos calendarios antiguos contaban los meses siguiendo a la Luna.

## La Luna mueve el mar
Aunque está lejísimos, la gravedad de la Luna jala el agua de los océanos. Por eso existen las **mareas**: en las playas el mar sube y baja dos veces al día.

> ¿Sabías que...? Siempre vemos la misma cara de la Luna, porque tarda lo mismo en girar sobre sí misma que en dar la vuelta a la Tierra.

## Huellas que no se borran
El 20 de julio de 1969, con la misión **Apolo 11**, **Neil Armstrong** se convirtió en la primera persona en caminar sobre la Luna. Desde entonces, doce astronautas la han pisado. Como allá no hay viento, sus huellas siguen marcadas en el polvo lunar.

Ahora vuela sobre los cráteres... ¡y cuidado con lo que se esconde entre ellos!'

  UNION ALL SELECT 'NQ-03', 'Una casa que vuela',
'¿Te imaginas vivir en una casa que vuela alrededor de la Tierra? Existe, y se llama **Estación Espacial Internacional**. Desde el año 2000 siempre ha habido astronautas viviendo en ella.

## Un laboratorio en el cielo
La Estación es tan grande como un campo de futbol. La construyeron entre varios países, pieza por pieza, como si fuera un juego de bloques gigante. Vuela a unos **400 kilómetros de altura**: si pudieras ir en carro hacia arriba, llegarías en unas 4 horas.

## Más rápida que una bala
La Estación viaja a unos **28,000 kilómetros por hora**. Va tan rápido que da una vuelta completa a la Tierra más o menos **cada 90 minutos**. Eso significa que los astronautas ven unos **16 amaneceres cada día**. ¡Imagina desayunar dieciséis veces!

> ¿Sabías que...? En una noche despejada puedes ver la Estación desde tu casa: parece una estrella muy brillante que cruza el cielo sin parpadear.

## ¿Qué hacen los astronautas?
Su trabajo principal es hacer **experimentos científicos** que no se pueden hacer en la Tierra. Por ejemplo:
- Estudian cómo crecen las plantas sin gravedad.
- Revisan qué le pasa al cuerpo humano después de meses en el espacio.
- Prueban materiales y máquinas para futuros viajes a la Luna y a Marte.

## La vida flotando
Allá arriba todo flota. Los astronautas duermen en bolsas de dormir amarradas a la pared, comen con cuidado para que las migajas no se escapen y hacen ejercicio unas dos horas al día para que sus músculos no se debiliten.

¡Prepara tu nave! Unos visitantes no invitados rodean la Estación.'

  UNION ALL SELECT 'NQ-04', 'Ayudantes en órbita',
'Ahora mismo, mientras lees esto, miles de máquinas dan vueltas sobre tu cabeza. No las ves, pero te ayudan todos los días. Son los **satélites artificiales**.

## ¿Qué es un satélite artificial?
Es una **máquina que construimos** y lanzamos en un cohete para que dé vueltas alrededor de la Tierra. Se llama "artificial" porque la hicimos las personas; la Luna, en cambio, es un satélite natural. El primero, el Sputnik 1, se lanzó en 1957 y era del tamaño de una pelota de playa.

## Trabajos muy importantes
Cada satélite tiene una tarea:
- **Satélites del clima:** toman fotos de las nubes y avisan cuando se acerca un huracán, para que la gente se prepare a tiempo.
- **Satélites de comunicaciones:** llevan la televisión, el internet y las llamadas de un lado del mundo a otro.
- **Satélites GPS:** ayudan al mapa del celular a saber dónde estás.
- **Satélites científicos:** observan los bosques, los océanos y hasta otras galaxias.

> ¿Sabías que...? Tu celular escucha a varios satélites GPS al mismo tiempo. Comparando sus señales calcula dónde estás con un error de solo unos metros.

## Energía del Sol
Allá arriba no hay gasolineras ni enchufes. Por eso casi todos los satélites tienen **paneles solares** que se abren como alas y convierten la luz del Sol en electricidad.

## Cuidado con la basura espacial
Cuando un satélite deja de funcionar, puede quedarse dando vueltas como basura espacial. Los científicos vigilan esos pedazos para que no choquen con los satélites que sí trabajan.

Ahora vas a volar por el cinturón de satélites. Los enemigos ahí son más rápidos: ¡mantén los ojos abiertos!'

  UNION ALL SELECT 'NQ-05', 'Una estrella muy cercana',
'Todas las mañanas sale una estrella por el horizonte y nos regala luz y calor. Sí, leíste bien: el **Sol es una estrella**, la más cercana a nosotros.

## Una bola de gas gigante
El Sol no es sólido como la Tierra. Es una enorme bola de gas muy caliente: su superficie está a unos **5,500 grados**, y su centro, ¡a millones de grados! Es tan grande que dentro cabrían **más de un millón de Tierras**. Si el Sol fuera del tamaño de una puerta, la Tierra sería como una moneda.

## Un viaje de 8 minutos
El Sol está a unos 150 millones de kilómetros. Su luz viaja rapidísimo, a 300,000 kilómetros por segundo, y aun así tarda unos **8 minutos** en llegar hasta aquí. La luz que ves por la ventana salió del Sol hace 8 minutos.

## Sin el Sol no habría vida
Gracias al Sol:
- Tenemos día, luz y calor.
- Las plantas fabrican su alimento con su luz.
- El agua se evapora y se forman las nubes y la lluvia.

> ¿Sabías que...? El Sol también lanza llamaradas: explosiones de energía que a veces provocan auroras de colores en el cielo, cerca de los polos.

## ¡Nunca lo mires directo!
La luz del Sol es tan fuerte que **puede dañar tus ojos**, aunque sea por poquito tiempo. Tampoco sirven los lentes de sol comunes. Para ver un eclipse se usan lentes especiales certificados, o un proyector hecho con una caja de cartón.

Tu nave va a volar muy cerca del Sol. Hace calor, las llamaradas suben y los enemigos de fuego disparan más rápido. ¡Mucha suerte, cadete!'

  UNION ALL SELECT 'NQ-06', 'Dibujos en el cielo',
'En una noche oscura, lejos de las luces de la ciudad, el cielo se llena de miles de puntitos brillantes. Cada uno es una estrella, y muchas son más grandes que nuestro Sol.

## Soles lejanísimos
Las estrellas son **soles** como el nuestro, pero están tan lejos que las vemos como puntitos. La luz de algunas tarda cientos o miles de años en llegar hasta nosotros.

## Dibujos con estrellas
Hace miles de años, las personas observaban el cielo y unían estrellas con líneas imaginarias para formar figuras de animales, héroes y objetos. Esos dibujos se llaman **constelaciones**. Hoy los astrónomos reconocen **88 constelaciones**. Algunas famosas son:
- **Orión, el cazador:** tiene tres estrellas en fila que forman su cinturón.
- **La Osa Mayor:** siete de sus estrellas parecen un cucharón gigante.
- **Casiopea:** sus estrellas forman una letra W.

## Estrellas de colores
Si miras con atención, verás que no todas son blancas. Su color nos dice qué tan calientes están:
- Las **azules** son las más calientes.
- Las amarillas, como el Sol, están en medio.
- Las **rojas** son las más frías.

## Una brújula en el cielo
La **Estrella Polar** casi no se mueve en el cielo y siempre marca dónde está el **norte**. Por eso, mucho antes de que existiera el GPS, los viajeros y marineros la usaban para no perderse.

> ¿Sabías que...? Las estrellas parecen parpadear porque su luz atraviesa el aire en movimiento. Los astronautas, desde el espacio, las ven brillar quietas.

Tu última misión es en el espacio profundo, el lugar más peligroso de todos. ¿Estás listo para el reto final?'
) n ON n.m = m.codigo
SET a.titulo = n.t, a.contenido = n.c;

-- ---------------------------------------------------------------------
-- 2. Preguntas (4 por misión). El juego revuelve las opciones al jugar.
-- ---------------------------------------------------------------------
INSERT INTO preguntas (articulo_id, texto, puntos, explicacion)
SELECT a.id, n.t, 10, n.x
FROM (
  SELECT 'NQ-01' AS m, '¿Por qué la Tierra se ve azul desde el espacio?' AS t,
         'Casi 71 de cada 100 partes de la superficie de la Tierra son océanos. ¡Debería llamarse planeta Agua!' AS x
  UNION ALL SELECT 'NQ-01', '¿Qué son los remolinos blancos que se ven sobre la Tierra?',
         'Desde el espacio se pueden ver huracanes completos girando como un remolino gigante.'
  UNION ALL SELECT 'NQ-01', '¿Cómo se llama la capa de aire que envuelve a la Tierra?',
         'Si la Tierra fuera una manzana, la atmósfera sería tan delgada como su cáscara.'
  UNION ALL SELECT 'NQ-01', '¿Cuánto tarda la Tierra en girar sobre sí misma?',
         'Mientras gira, la mitad que mira al Sol tiene día y la otra mitad tiene noche.'

  UNION ALL SELECT 'NQ-02', '¿Por qué brilla la Luna?',
         'La Luna es tan oscura como el asfalto de la calle: la vemos brillar porque el Sol la ilumina.'
  UNION ALL SELECT 'NQ-02', '¿Cuánto dura el ciclo completo de las fases de la Luna?',
         'Por eso muchos calendarios antiguos contaban los meses siguiendo a la Luna.'
  UNION ALL SELECT 'NQ-02', '¿Qué provoca la gravedad de la Luna en los océanos?',
         'Su gravedad jala el agua: en las playas el mar sube y baja dos veces al día.'
  UNION ALL SELECT 'NQ-02', '¿Quién fue la primera persona en caminar sobre la Luna?',
         'Fue en 1969, con la misión Apolo 11. ¡Sus huellas siguen ahí porque en la Luna no hay viento!'

  UNION ALL SELECT 'NQ-04', '¿Qué es un satélite artificial?',
         'En este momento hay miles de satélites dando vueltas alrededor de la Tierra.'
  UNION ALL SELECT 'NQ-04', '¿Cómo nos ayudan los satélites del clima?',
         'Toman fotos de las nubes desde arriba y así se sabe hacia dónde va una tormenta.'
  UNION ALL SELECT 'NQ-04', '¿De dónde sacan su energía casi todos los satélites?',
         'Sus paneles solares convierten la luz del Sol en electricidad, ¡sin gastar gasolina!'
  UNION ALL SELECT 'NQ-04', '¿Qué satélites ayudan al mapa del celular a saber dónde estás?',
         'Tu celular escucha a varios satélites GPS al mismo tiempo para calcular dónde estás.'

  UNION ALL SELECT 'NQ-05', '¿Qué es el Sol?',
         'Las estrellas que ves de noche también son soles, solo que están muchísimo más lejos.'
  UNION ALL SELECT 'NQ-05', '¿Cuánto tarda la luz del Sol en llegar a la Tierra?',
         'Viaja a 300,000 km por segundo. ¡La luz que ves ahora salió del Sol hace 8 minutos!'
  UNION ALL SELECT 'NQ-05', '¿Cuántas Tierras cabrían dentro del Sol?',
         'Si el Sol fuera del tamaño de una puerta, la Tierra sería del tamaño de una moneda.'
  UNION ALL SELECT 'NQ-05', '¿Por qué no debes mirar el Sol directamente?',
         'Para ver un eclipse se usan lentes especiales certificados, no lentes de sol comunes.'

  UNION ALL SELECT 'NQ-06', '¿Qué es una constelación?',
         'Hoy los astrónomos reconocen 88 constelaciones en todo el cielo.'
  UNION ALL SELECT 'NQ-06', '¿De qué color son las estrellas más calientes?',
         'Pasa como en la estufa: la flama azul quema más que la flama naranja.'
  UNION ALL SELECT 'NQ-06', '¿Para qué usaban los viajeros la Estrella Polar?',
         'Casi no se mueve en el cielo, así que siempre marca dónde está el norte.'
  UNION ALL SELECT 'NQ-06', '¿Por qué las estrellas parecen parpadear?',
         'En el espacio no hay aire, así que los astronautas las ven brillar sin parpadear.'
) n
JOIN misiones m ON m.codigo = n.m
JOIN articulos a ON a.mision_id = m.id AND a.orden = 1
WHERE NOT EXISTS (SELECT 1 FROM preguntas pr WHERE pr.texto = n.t);

-- ---------------------------------------------------------------------
-- 3. Opciones (3 por pregunta, una correcta)
-- ---------------------------------------------------------------------
INSERT INTO opciones (pregunta_id, texto, es_correcta)
SELECT pr.id, n.o, n.c
FROM (
  SELECT '¿Por qué la Tierra se ve azul desde el espacio?' AS t, 'El agua cubre casi tres cuartas partes del planeta' AS o, 1 AS c
  UNION ALL SELECT '¿Por qué la Tierra se ve azul desde el espacio?', 'Los astronautas la pintaron', 0
  UNION ALL SELECT '¿Por qué la Tierra se ve azul desde el espacio?', 'Está cubierta de hielo azul', 0
  UNION ALL SELECT '¿Qué son los remolinos blancos que se ven sobre la Tierra?', 'Nubes', 1
  UNION ALL SELECT '¿Qué son los remolinos blancos que se ven sobre la Tierra?', 'Humo de cohetes', 0
  UNION ALL SELECT '¿Qué son los remolinos blancos que se ven sobre la Tierra?', 'Montañas de sal', 0
  UNION ALL SELECT '¿Cómo se llama la capa de aire que envuelve a la Tierra?', 'Atmósfera', 1
  UNION ALL SELECT '¿Cómo se llama la capa de aire que envuelve a la Tierra?', 'Órbita', 0
  UNION ALL SELECT '¿Cómo se llama la capa de aire que envuelve a la Tierra?', 'Galaxia', 0
  UNION ALL SELECT '¿Cuánto tarda la Tierra en girar sobre sí misma?', 'Unas 24 horas', 1
  UNION ALL SELECT '¿Cuánto tarda la Tierra en girar sobre sí misma?', 'Una hora', 0
  UNION ALL SELECT '¿Cuánto tarda la Tierra en girar sobre sí misma?', 'Cien años', 0

  UNION ALL SELECT '¿Por qué brilla la Luna?', 'Refleja la luz del Sol', 1
  UNION ALL SELECT '¿Por qué brilla la Luna?', 'Tiene volcanes encendidos', 0
  UNION ALL SELECT '¿Por qué brilla la Luna?', 'Está hecha de focos', 0
  UNION ALL SELECT '¿Cuánto dura el ciclo completo de las fases de la Luna?', 'Unos 29 días y medio', 1
  UNION ALL SELECT '¿Cuánto dura el ciclo completo de las fases de la Luna?', 'Un solo día', 0
  UNION ALL SELECT '¿Cuánto dura el ciclo completo de las fases de la Luna?', 'Diez años', 0
  UNION ALL SELECT '¿Qué provoca la gravedad de la Luna en los océanos?', 'Las mareas', 1
  UNION ALL SELECT '¿Qué provoca la gravedad de la Luna en los océanos?', 'Que el agua sea salada', 0
  UNION ALL SELECT '¿Qué provoca la gravedad de la Luna en los océanos?', 'Que haya peces', 0
  UNION ALL SELECT '¿Quién fue la primera persona en caminar sobre la Luna?', 'Neil Armstrong', 1
  UNION ALL SELECT '¿Quién fue la primera persona en caminar sobre la Luna?', 'Cristóbal Colón', 0
  UNION ALL SELECT '¿Quién fue la primera persona en caminar sobre la Luna?', 'Albert Einstein', 0

  UNION ALL SELECT '¿Qué es un satélite artificial?', 'Una máquina que da vueltas alrededor de la Tierra', 1
  UNION ALL SELECT '¿Qué es un satélite artificial?', 'Una estrella pequeñita', 0
  UNION ALL SELECT '¿Qué es un satélite artificial?', 'Un pedazo de la Luna', 0
  UNION ALL SELECT '¿Cómo nos ayudan los satélites del clima?', 'Avisan cuando se acerca un huracán', 1
  UNION ALL SELECT '¿Cómo nos ayudan los satélites del clima?', 'Hacen que llueva', 0
  UNION ALL SELECT '¿Cómo nos ayudan los satélites del clima?', 'Apagan el Sol de noche', 0
  UNION ALL SELECT '¿De dónde sacan su energía casi todos los satélites?', 'De paneles solares', 1
  UNION ALL SELECT '¿De dónde sacan su energía casi todos los satélites?', 'De gasolina', 0
  UNION ALL SELECT '¿De dónde sacan su energía casi todos los satélites?', 'De un cable muy largo', 0
  UNION ALL SELECT '¿Qué satélites ayudan al mapa del celular a saber dónde estás?', 'Los satélites GPS', 1
  UNION ALL SELECT '¿Qué satélites ayudan al mapa del celular a saber dónde estás?', 'Los satélites del clima', 0
  UNION ALL SELECT '¿Qué satélites ayudan al mapa del celular a saber dónde estás?', 'La Luna', 0

  UNION ALL SELECT '¿Qué es el Sol?', 'Una estrella', 1
  UNION ALL SELECT '¿Qué es el Sol?', 'Un planeta', 0
  UNION ALL SELECT '¿Qué es el Sol?', 'Una luna gigante', 0
  UNION ALL SELECT '¿Cuánto tarda la luz del Sol en llegar a la Tierra?', 'Unos 8 minutos', 1
  UNION ALL SELECT '¿Cuánto tarda la luz del Sol en llegar a la Tierra?', 'Un año', 0
  UNION ALL SELECT '¿Cuánto tarda la luz del Sol en llegar a la Tierra?', 'Llega al instante', 0
  UNION ALL SELECT '¿Cuántas Tierras cabrían dentro del Sol?', 'Más de un millón', 1
  UNION ALL SELECT '¿Cuántas Tierras cabrían dentro del Sol?', 'Solo diez', 0
  UNION ALL SELECT '¿Cuántas Tierras cabrían dentro del Sol?', 'Ninguna, es más pequeño', 0
  UNION ALL SELECT '¿Por qué no debes mirar el Sol directamente?', 'Puede dañar tus ojos', 1
  UNION ALL SELECT '¿Por qué no debes mirar el Sol directamente?', 'Porque se apaga', 0
  UNION ALL SELECT '¿Por qué no debes mirar el Sol directamente?', 'Porque te da sueño', 0

  UNION ALL SELECT '¿Qué es una constelación?', 'Un dibujo que formamos uniendo estrellas', 1
  UNION ALL SELECT '¿Qué es una constelación?', 'Una estrella muy grande', 0
  UNION ALL SELECT '¿Qué es una constelación?', 'Un planeta con anillos', 0
  UNION ALL SELECT '¿De qué color son las estrellas más calientes?', 'Azul', 1
  UNION ALL SELECT '¿De qué color son las estrellas más calientes?', 'Roja', 0
  UNION ALL SELECT '¿De qué color son las estrellas más calientes?', 'Verde', 0
  UNION ALL SELECT '¿Para qué usaban los viajeros la Estrella Polar?', 'Para encontrar el norte', 1
  UNION ALL SELECT '¿Para qué usaban los viajeros la Estrella Polar?', 'Para alumbrar el camino', 0
  UNION ALL SELECT '¿Para qué usaban los viajeros la Estrella Polar?', 'Para pedir deseos', 0
  UNION ALL SELECT '¿Por qué las estrellas parecen parpadear?', 'Su luz atraviesa el aire en movimiento', 1
  UNION ALL SELECT '¿Por qué las estrellas parecen parpadear?', 'Se encienden y se apagan', 0
  UNION ALL SELECT '¿Por qué las estrellas parecen parpadear?', 'Están cansadas', 0
) n
JOIN preguntas pr ON pr.texto = n.t
WHERE NOT EXISTS (SELECT 1 FROM opciones op WHERE op.pregunta_id = pr.id AND op.texto = n.o);

-- ---------------------------------------------------------------------
-- 4. Jefes finales derrotados: los puntos extra se dan una sola vez por
--    misión a cada cadete (ver r=jefe en api/index.php)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS jefes_derrotados (
  usuario_id   INT UNSIGNED NOT NULL,
  mision_id    INT UNSIGNED NOT NULL,
  puntos       INT UNSIGNED NOT NULL DEFAULT 0,
  derrotado_en TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (usuario_id, mision_id),
  KEY fk_jd_mision (mision_id),
  CONSTRAINT fk_jd_user   FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE,
  CONSTRAINT fk_jd_mision FOREIGN KEY (mision_id)  REFERENCES misiones (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
