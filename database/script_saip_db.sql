-- Seed de accesos SAIP/TTAIP
-- Uso:
--   mysql -u root -p saip_db < database/script_saip_db.sql
-- Password comun de prueba para todos los usuarios: Saip2026*
-- Nota: el backend acepta password legacy plaintext y migra a BCrypt en el primer login exitoso.

USE saip_db;

-- Normalizar columnas de resultado para decisiones/resoluciones largas
ALTER TABLE apelaciones MODIFY COLUMN resultado VARCHAR(60) NULL;
ALTER TABLE resoluciones MODIFY COLUMN resultado VARCHAR(60) NULL;

START TRANSACTION;

-- -----------------------------------------------------------------------------
-- 1) Entidades publicas (10)
-- -----------------------------------------------------------------------------
INSERT INTO entidades (nombre,
                       acronimo,
                       descripcion,
                       fecha_registro,
                       activa,
                       direccion,
                       telefono,
                       email,
                       estado)
VALUES ('Ministerio de Educacion', 'MINEDU', 'Entidad publica del sector educacion', NOW(), TRUE,
        'Calle Del Comercio 193, San Borja, Lima', '014400000', 'mesa.partes@minedu.gob.pe', 'Activa'),
       ('Ministerio de Salud', 'MINSA', 'Entidad publica del sector salud', NOW(), TRUE,
        'Av. Salaverry 801, Jesus Maria, Lima', '013150000', 'mesa.partes@minsa.gob.pe', 'Activa'),
       ('Ministerio del Interior', 'MININTER', 'Entidad publica del sector interior', NOW(), TRUE,
        'Plaza 30 de Agosto S/N, San Isidro, Lima', '015136000', 'mesa.partes@mininter.gob.pe', 'Activa'),
       ('Ministerio de Justicia y DDHH', 'MINJUSDH', 'Entidad publica del sector justicia', NOW(), TRUE,
        'Calle Scipion Llona 350, Miraflores, Lima', '012045000', 'mesa.partes@minjus.gob.pe', 'Activa'),
       ('Ministerio de Economia y Finanzas', 'MEF', 'Entidad publica del sector economia y finanzas', NOW(), TRUE,
        'Jr. Junin 319, Cercado de Lima', '013112000', 'mesa.partes@mef.gob.pe', 'Activa'),
       ('Ministerio de Transportes y Comunicaciones', 'MTC', 'Entidad publica del sector transportes', NOW(), TRUE,
        'Jr. Zorritos 1203, Cercado de Lima', '016151000', 'mesa.partes@mtc.gob.pe', 'Activa'),
       ('Ministerio de Desarrollo e Inclusion Social', 'MIDIS', 'Entidad publica del sector desarrollo social', NOW(),
        TRUE, 'Av. Paseo de la Republica 3101, San Isidro, Lima', '016313000', 'mesa.partes@midis.gob.pe', 'Activa'),
       ('Ministerio del Ambiente', 'MINAM', 'Entidad publica del sector ambiente', NOW(), TRUE,
        'Av. Antonio Miroquesada 425, Magdalena del Mar, Lima', '016111000', 'mesa.partes@minam.gob.pe', 'Activa'),
       ('Superintendencia Nacional de Aduanas y de Administracion Tributaria', 'SUNAT',
        'Entidad publica de administracion tributaria', NOW(), TRUE, 'Av. Garcilaso de la Vega 1472, Cercado de Lima',
        '016340000', 'mesa.partes@sunat.gob.pe', 'Activa'),
       ('Organismo Supervisor de Inversion Privada en Telecomunicaciones', 'OSIPTEL',
        'Entidad reguladora de telecomunicaciones', NOW(), TRUE, 'Calle De la Prosa 136, San Borja, Lima', '012251313',
        'mesa.partes@osiptel.gob.pe', 'Activa')
ON DUPLICATE KEY UPDATE nombre      = VALUES(nombre),
                        descripcion = VALUES(descripcion),
                        activa      = VALUES(activa),
                        direccion   = VALUES(direccion),
                        telefono    = VALUES(telefono),
                        email       = VALUES(email),
                        estado      = VALUES(estado);

-- -----------------------------------------------------------------------------
-- 2) Ciudadanos (10) - acceso ciudadano en frontend: /login
--    Identificador permitido: email o DNI (8 digitos)
-- -----------------------------------------------------------------------------
INSERT INTO usuarios (email, password, tipo_usuario, fecha_registro, activo)
VALUES ('ciudadano01@gmail.com', 'Saip2026*', 'CIUDADANO', NOW(), TRUE),
       ('ciudadano02@hotmail.com', 'Saip2026*', 'CIUDADANO', NOW(), TRUE),
       ('ciudadano03@outlook.com', 'Saip2026*', 'CIUDADANO', NOW(), TRUE),
       ('ciudadano04@yahoo.com', 'Saip2026*', 'CIUDADANO', NOW(), TRUE),
       ('ciudadano05@gmail.com', 'Saip2026*', 'CIUDADANO', NOW(), TRUE),
       ('ciudadano06@hotmail.com', 'Saip2026*', 'CIUDADANO', NOW(), TRUE),
       ('ciudadano07@outlook.com', 'Saip2026*', 'CIUDADANO', NOW(), TRUE),
       ('ciudadano08@yahoo.com', 'Saip2026*', 'CIUDADANO', NOW(), TRUE),
       ('ciudadano09@gmail.com', 'Saip2026*', 'CIUDADANO', NOW(), TRUE),
       ('ciudadano10@hotmail.com', 'Saip2026*', 'CIUDADANO', NOW(), TRUE)
ON DUPLICATE KEY UPDATE password     = VALUES(password),
                        tipo_usuario = VALUES(tipo_usuario),
                        activo       = VALUES(activo);

INSERT INTO ciudadanos (id_usuario, dni, nombre_completo, telefono, direccion)
SELECT u.id_usuario, c.dni, c.nombre_completo, c.telefono, c.direccion
FROM (SELECT 'ciudadano01@gmail.com' AS email,
             '70000001'              AS dni,
             'Ciudadano Demo 01'     AS nombre_completo,
             '900000001'             AS telefono,
             'Lima - Peru'           AS direccion
      UNION ALL
      SELECT 'ciudadano02@hotmail.com', '70000002', 'Ciudadano Demo 02', '900000002', 'Lima - Peru'
      UNION ALL
      SELECT 'ciudadano03@outlook.com', '70000003', 'Ciudadano Demo 03', '900000003', 'Lima - Peru'
      UNION ALL
      SELECT 'ciudadano04@yahoo.com', '70000004', 'Ciudadano Demo 04', '900000004', 'Lima - Peru'
      UNION ALL
      SELECT 'ciudadano05@gmail.com', '70000005', 'Ciudadano Demo 05', '900000005', 'Lima - Peru'
      UNION ALL
      SELECT 'ciudadano06@hotmail.com', '70000006', 'Ciudadano Demo 06', '900000006', 'Lima - Peru'
      UNION ALL
      SELECT 'ciudadano07@outlook.com', '70000007', 'Ciudadano Demo 07', '900000007', 'Lima - Peru'
      UNION ALL
      SELECT 'ciudadano08@yahoo.com', '70000008', 'Ciudadano Demo 08', '900000008', 'Lima - Peru'
      UNION ALL
      SELECT 'ciudadano09@gmail.com', '70000009', 'Ciudadano Demo 09', '900000009', 'Lima - Peru'
      UNION ALL
      SELECT 'ciudadano10@hotmail.com', '70000010', 'Ciudadano Demo 10', '900000010', 'Lima - Peru') c
         JOIN usuarios u ON u.email = c.email
ON DUPLICATE KEY UPDATE dni             = VALUES(dni),
                        nombre_completo = VALUES(nombre_completo),
                        telefono        = VALUES(telefono),
                        direccion       = VALUES(direccion);

-- -----------------------------------------------------------------------------
-- 3) Miembros TTAIP (10) - acceso frontend: /acceso-ttaip (email + password)
-- -----------------------------------------------------------------------------
INSERT INTO usuarios (email, password, tipo_usuario, fecha_registro, activo)
VALUES ('ttaip01@minjus.gob.pe', 'Saip2026*', 'TTAIP', NOW(), TRUE),
       ('ttaip02@minjus.gob.pe', 'Saip2026*', 'TTAIP', NOW(), TRUE),
       ('ttaip03@minjus.gob.pe', 'Saip2026*', 'TTAIP', NOW(), TRUE),
       ('ttaip04@minjus.gob.pe', 'Saip2026*', 'TTAIP', NOW(), TRUE),
       ('ttaip05@minjus.gob.pe', 'Saip2026*', 'TTAIP', NOW(), TRUE),
       ('ttaip06@minjus.gob.pe', 'Saip2026*', 'TTAIP', NOW(), TRUE),
       ('ttaip07@minjus.gob.pe', 'Saip2026*', 'TTAIP', NOW(), TRUE),
       ('ttaip08@minjus.gob.pe', 'Saip2026*', 'TTAIP', NOW(), TRUE),
       ('ttaip09@minjus.gob.pe', 'Saip2026*', 'TTAIP', NOW(), TRUE),
       ('ttaip10@minjus.gob.pe', 'Saip2026*', 'TTAIP', NOW(), TRUE)
ON DUPLICATE KEY UPDATE password     = VALUES(password),
                        tipo_usuario = VALUES(tipo_usuario),
                        activo       = VALUES(activo);

INSERT INTO miembros_ttaip (id_usuario, nombre_completo, cargo, sala, especialidad)
SELECT u.id_usuario, t.nombre_completo, t.cargo, t.sala, t.especialidad
FROM (SELECT 'ttaip01@minjus.gob.pe'             AS email,
             'Tatiana Azucena Valverde Alvarado' AS nombre_completo,
             'Presidenta'                        AS cargo,
             'PRIMERA SALA'                      AS sala,
             'Derecho administrativo'            AS especialidad
      UNION ALL
      SELECT 'ttaip02@minjus.gob.pe',
             'Luis Guillermo Agurto Villegas',
             'Vocal',
             'PRIMERA SALA',
             'Transparencia y acceso'
      UNION ALL
      SELECT 'ttaip03@minjus.gob.pe', 'Segundo Ulises Zamora Barboza', 'Vocal', 'PRIMERA SALA', 'Gestion publica'
      UNION ALL
      SELECT 'ttaip04@minjus.gob.pe',
             'Junior Pichon De la Cruz',
             'Presidente',
             'SEGUNDA SALA',
             'Procedimiento administrativo'
      UNION ALL
      SELECT 'ttaip05@minjus.gob.pe', 'Julio Cesar Mancilla Crespo', 'Vocal', 'SEGUNDA SALA', 'Derecho constitucional'
      UNION ALL
      SELECT 'ttaip06@minjus.gob.pe', 'Jessica Martha Rojas Barrueta', 'Vocal', 'SEGUNDA SALA', 'Proteccion de datos'
      UNION ALL
      SELECT 'ttaip07@minjus.gob.pe', 'Miembro TTAIP Demo 07', 'Vocal', 'PRIMERA SALA', 'Acceso a la informacion'
      UNION ALL
      SELECT 'ttaip08@minjus.gob.pe', 'Miembro TTAIP Demo 08', 'Vocal', 'SEGUNDA SALA', 'Gestion documental'
      UNION ALL
      SELECT 'ttaip09@minjus.gob.pe', 'Miembro TTAIP Demo 09', 'Vocal', 'PRIMERA SALA', 'Gobierno digital'
      UNION ALL
      SELECT 'ttaip10@minjus.gob.pe', 'Miembro TTAIP Demo 10', 'Vocal', 'SEGUNDA SALA', 'Analisis normativo') t
         JOIN usuarios u ON u.email = t.email
ON DUPLICATE KEY UPDATE nombre_completo = VALUES(nombre_completo),
                        cargo           = VALUES(cargo),
                        sala            = VALUES(sala),
                        especialidad    = VALUES(especialidad);

-- -----------------------------------------------------------------------------
-- 4) Administrador - acceso frontend: /acceso-admin (email + password)
-- -----------------------------------------------------------------------------
INSERT INTO usuarios (email, password, tipo_usuario, fecha_registro, activo)
VALUES ('admin@saip.gob.pe', 'Saip2026*', 'ADMINISTRADOR', NOW(), TRUE)
ON DUPLICATE KEY UPDATE password     = VALUES(password),
                        tipo_usuario = VALUES(tipo_usuario),
                        activo       = VALUES(activo);

INSERT INTO administradores (id_usuario, nombre_completo, rol, permisos)
SELECT u.id_usuario, 'Administrador General SAIP', 'SUPER_ADMIN', 'USUARIOS,ENTIDADES,REPORTES,CONFIGURACION'
FROM usuarios u
WHERE u.email = 'admin@saip.gob.pe'
ON DUPLICATE KEY UPDATE nombre_completo = VALUES(nombre_completo),
                        rol             = VALUES(rol),
                        permisos        = VALUES(permisos);

-- -----------------------------------------------------------------------------
-- 5) Funcionarios (10) - 1 por cada entidad publica
--    Acceso frontend: /acceso-funcionario (email + password)
--    Patron email: func.<acronimo>@<entidad>.gob.pe
-- -----------------------------------------------------------------------------
INSERT INTO usuarios (email, password, tipo_usuario, fecha_registro, activo)
SELECT CONCAT('func.', LOWER(e.acronimo), '@', LOWER(e.acronimo), '.gob.pe') AS email,
       'Saip2026*'                                                           AS password,
       'FUNCIONARIO'                                                         AS tipo_usuario,
       NOW()                                                                 AS fecha_registro,
       TRUE                                                                  AS activo
FROM entidades e
WHERE e.acronimo IN ('MINEDU', 'MINSA', 'MININTER', 'MINJUSDH', 'MEF', 'MTC', 'MIDIS', 'MINAM', 'SUNAT', 'OSIPTEL')
ON DUPLICATE KEY UPDATE password     = VALUES(password),
                        tipo_usuario = VALUES(tipo_usuario),
                        activo       = VALUES(activo);

INSERT INTO funcionarios (id_usuario, nombre_completo, cargo, area, telefono, id_entidad)
SELECT u.id_usuario,
       CONCAT('Funcionario ', e.acronimo, ' Principal') AS nombre_completo,
       'Especialista de Acceso a la Informacion'        AS cargo,
       'Oficina de Acceso a la Informacion'             AS area,
       CONCAT('9', LPAD(e.id_entidad, 8, '0'))          AS telefono,
       e.id_entidad
FROM entidades e
         JOIN usuarios u ON u.email = CONCAT('func.', LOWER(e.acronimo), '@', LOWER(e.acronimo), '.gob.pe')
WHERE e.acronimo IN ('MINEDU', 'MINSA', 'MININTER', 'MINJUSDH', 'MEF', 'MTC', 'MIDIS', 'MINAM', 'SUNAT', 'OSIPTEL')
ON DUPLICATE KEY UPDATE nombre_completo = VALUES(nombre_completo),
                        cargo           = VALUES(cargo),
                        area            = VALUES(area),
                        telefono        = VALUES(telefono),
                        id_entidad      = VALUES(id_entidad);


-- -----------------------------------------------------------------------------
-- 6) Solicitudes SAIP de prueba (5) + respuestas y apelaciones base para Postman
--    Formatos:
--      SAIP: SAIP-AAAA-NNNNN
--      TTAIP: NNNNN-AAAA-JUS/TTAIP
-- -----------------------------------------------------------------------------
INSERT INTO solicitudes (expediente,
                         asunto,
                         descripcion,
                         id_ciudadano,
                         id_entidad,
                         fecha_presentacion,
                         fecha_limite,
                         estado,
                         prioridad,
                         formato_digital,
                         formato_fisico,
                         copia_simple,
                         copia_certificada,
                         tipo_informacion)
SELECT 'SAIP-2025-00001',
       'Solicitud de informacion sobre presupuesto institucional',
       'Solicito el detalle del presupuesto institucional y su ejecucion del ultimo periodo.',
       c.id_usuario,
       e.id_entidad,
       DATE_SUB(NOW(), INTERVAL 6 DAY),
       DATE_ADD(CURDATE(), INTERVAL 4 DAY),
       'RECEPCIONADA',
       'MEDIA',
       TRUE,
       FALSE,
       TRUE,
       FALSE,
       'Informacion presupuestal'
FROM ciudadanos c
         JOIN usuarios u ON u.id_usuario = c.id_usuario
         JOIN entidades e ON e.acronimo = 'MINEDU'
WHERE u.email = 'ciudadano01@gmail.com'
  AND NOT EXISTS (SELECT 1 FROM solicitudes s WHERE s.expediente = 'SAIP-2025-00001');

INSERT INTO solicitudes (expediente,
                         asunto,
                         descripcion,
                         id_ciudadano,
                         id_entidad,
                         fecha_presentacion,
                         fecha_limite,
                         estado,
                         prioridad,
                         formato_digital,
                         formato_fisico,
                         copia_simple,
                         copia_certificada,
                         tipo_informacion)
SELECT 'SAIP-2025-00002',
       'Solicitud de contratos de adquisicion',
       'Solicito informacion sobre contratos de adquisicion del ultimo trimestre.',
       c.id_usuario,
       e.id_entidad,
       DATE_SUB(NOW(), INTERVAL 8 DAY),
       DATE_ADD(CURDATE(), INTERVAL 2 DAY),
       'EN_REVISION',
       'ALTA',
       TRUE,
       TRUE,
       TRUE,
       FALSE,
       'Contrataciones del Estado'
FROM ciudadanos c
         JOIN usuarios u ON u.id_usuario = c.id_usuario
         JOIN entidades e ON e.acronimo = 'MINSA'
WHERE u.email = 'ciudadano02@hotmail.com'
  AND NOT EXISTS (SELECT 1 FROM solicitudes s WHERE s.expediente = 'SAIP-2025-00002');

INSERT INTO solicitudes (expediente,
                         asunto,
                         descripcion,
                         id_ciudadano,
                         id_entidad,
                         fecha_presentacion,
                         fecha_limite,
                         estado,
                         prioridad,
                         formato_digital,
                         formato_fisico,
                         copia_simple,
                         copia_certificada,
                         tipo_informacion)
SELECT 'SAIP-2025-00003',
       'Solicitud de ejecucion de obras publicas',
       'Solicito reportes de avance y ejecucion de obras publicas del periodo anual.',
       c.id_usuario,
       e.id_entidad,
       DATE_SUB(NOW(), INTERVAL 15 DAY),
       DATE_SUB(CURDATE(), INTERVAL 2 DAY),
       'RESPONDIDA',
       'MEDIA',
       TRUE,
       FALSE,
       TRUE,
       FALSE,
       'Obras publicas'
FROM ciudadanos c
         JOIN usuarios u ON u.id_usuario = c.id_usuario
         JOIN entidades e ON e.acronimo = 'MININTER'
WHERE u.email = 'ciudadano03@outlook.com'
  AND NOT EXISTS (SELECT 1 FROM solicitudes s WHERE s.expediente = 'SAIP-2025-00003');

INSERT INTO solicitudes (expediente,
                         asunto,
                         descripcion,
                         id_ciudadano,
                         id_entidad,
                         fecha_presentacion,
                         fecha_limite,
                         estado,
                         prioridad,
                         formato_digital,
                         formato_fisico,
                         copia_simple,
                         copia_certificada,
                         tipo_informacion)
SELECT 'SAIP-2025-00004',
       'Solicitud de informes disciplinarios',
       'Solicito informes disciplinarios emitidos durante el ultimo semestre.',
       c.id_usuario,
       e.id_entidad,
       DATE_SUB(NOW(), INTERVAL 13 DAY),
       DATE_SUB(CURDATE(), INTERVAL 1 DAY),
       'DENEGADA',
       'ALTA',
       TRUE,
       FALSE,
       TRUE,
       TRUE,
       'Informes disciplinarios'
FROM ciudadanos c
         JOIN usuarios u ON u.id_usuario = c.id_usuario
         JOIN entidades e ON e.acronimo = 'MINJUSDH'
WHERE u.email = 'ciudadano04@yahoo.com'
  AND NOT EXISTS (SELECT 1 FROM solicitudes s WHERE s.expediente = 'SAIP-2025-00004');

INSERT INTO solicitudes (expediente,
                         asunto,
                         descripcion,
                         id_ciudadano,
                         id_entidad,
                         fecha_presentacion,
                         fecha_limite,
                         estado,
                         prioridad,
                         formato_digital,
                         formato_fisico,
                         copia_simple,
                         copia_certificada,
                         tipo_informacion)
SELECT 'SAIP-2025-00005',
       'Solicitud de actas de comite tecnico',
       'Solicito actas y acuerdos del comite tecnico del ultimo bimestre.',
       c.id_usuario,
       e.id_entidad,
       DATE_SUB(NOW(), INTERVAL 20 DAY),
       DATE_SUB(CURDATE(), INTERVAL 5 DAY),
       'CONCLUIDA',
       'NORMAL',
       TRUE,
       TRUE,
       TRUE,
       FALSE,
       'Actas institucionales'
FROM ciudadanos c
         JOIN usuarios u ON u.id_usuario = c.id_usuario
         JOIN entidades e ON e.acronimo = 'MEF'
WHERE u.email = 'ciudadano05@gmail.com'
  AND NOT EXISTS (SELECT 1 FROM solicitudes s WHERE s.expediente = 'SAIP-2025-00005');

INSERT INTO respuestas (id_solicitud,
                        id_funcionario,
                        tipo_respuesta,
                        contenido,
                        causal_denegatoria,
                        fundamento_legal,
                        fecha_respuesta,
                        decision)
SELECT s.id_solicitud,
       f.id_usuario,
       'ENTREGA_TOTAL',
       'Se entrega la informacion solicitada en formato digital, con detalle de obras y avances.',
       NULL,
       NULL,
       DATE_SUB(NOW(), INTERVAL 3 DAY),
       'aceptar'
FROM solicitudes s
         JOIN funcionarios f ON f.id_usuario = (SELECT u.id_usuario
                                                FROM usuarios u
                                                WHERE u.email = 'func.mininter@mininter.gob.pe'
                                                LIMIT 1)
WHERE s.expediente = 'SAIP-2025-00003'
  AND NOT EXISTS (SELECT 1 FROM respuestas r WHERE r.id_solicitud = s.id_solicitud);

INSERT INTO respuestas (id_solicitud,
                        id_funcionario,
                        tipo_respuesta,
                        contenido,
                        causal_denegatoria,
                        fundamento_legal,
                        fecha_respuesta,
                        decision)
SELECT s.id_solicitud,
       f.id_usuario,
       'DENEGACION_TOTAL',
       'No es posible atender la solicitud por tratarse de informacion clasificada.',
       'Informacion vinculada a investigaciones en tramite',
       'Articulo 15-B de la Ley 27806',
       DATE_SUB(NOW(), INTERVAL 2 DAY),
       'denegar'
FROM solicitudes s
         JOIN funcionarios f ON f.id_usuario = (SELECT u.id_usuario
                                                FROM usuarios u
                                                WHERE u.email = 'func.minjusdh@minjusdh.gob.pe'
                                                LIMIT 1)
WHERE s.expediente = 'SAIP-2025-00004'
  AND NOT EXISTS (SELECT 1 FROM respuestas r WHERE r.id_solicitud = s.id_solicitud);

INSERT INTO apelaciones (expediente,
                         fundamentos,
                         estado,
                         id_solicitud,
                         id_ciudadano,
                         fecha_apelacion)
SELECT '01560-2025-JUS/TTAIP',
       'Apelo la denegatoria por considerar que la informacion es de interes publico y no se acredito excepcion legal suficiente.',
       'EN_CALIFICACION_1',
       s.id_solicitud,
       s.id_ciudadano,
       DATE_SUB(NOW(), INTERVAL 1 DAY)
FROM solicitudes s
WHERE s.expediente = 'SAIP-2025-00004'
  AND NOT EXISTS (SELECT 1
                  FROM apelaciones a
                  WHERE a.expediente = '01560-2025-JUS/TTAIP'
                     OR a.id_solicitud = s.id_solicitud);

INSERT INTO apelaciones (expediente,
                         fundamentos,
                         estado,
                         id_solicitud,
                         id_ciudadano,
                         fecha_apelacion,
                         fecha_subsanacion,
                         dias_subsanacion)
SELECT '01561-2025-JUS/TTAIP',
       'Se presentan fundamentos adicionales para subsanar las observaciones notificadas por el Tribunal.',
       'EN_SUBSANACION',
       s.id_solicitud,
       s.id_ciudadano,
       DATE_SUB(NOW(), INTERVAL 4 DAY),
       CURDATE(),
       2
FROM solicitudes s
WHERE s.expediente = 'SAIP-2025-00005'
  AND NOT EXISTS (SELECT 1
                  FROM apelaciones a
                  WHERE a.expediente = '01561-2025-JUS/TTAIP'
                     OR a.id_solicitud = s.id_solicitud);

COMMIT;

-- -----------------------------------------------------------------------------
-- Verificacion rapida de conteos
-- -----------------------------------------------------------------------------
SELECT 'entidades' AS tabla, COUNT(*) AS total
FROM entidades
UNION ALL
SELECT 'usuarios', COUNT(*)
FROM usuarios
UNION ALL
SELECT 'ciudadanos', COUNT(*)
FROM ciudadanos
UNION ALL
SELECT 'funcionarios', COUNT(*)
FROM funcionarios
UNION ALL
SELECT 'miembros_ttaip', COUNT(*)
FROM miembros_ttaip
UNION ALL
SELECT 'administradores', COUNT(*)
FROM administradores;




