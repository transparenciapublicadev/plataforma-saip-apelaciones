-- Seed de accesos SAIP/TTAIP
-- Uso:
--   mysql -u root -p saip_db < database/script_saip_db.sql
-- Password comun de prueba para todos los usuarios: Saip2026*
-- Nota: el backend acepta password legacy plaintext y migra a BCrypt en el primer login exitoso.

USE saip_db;

-- Normalizar columnas de resultado para decisiones/resoluciones largas
ALTER TABLE apelaciones MODIFY COLUMN resultado VARCHAR(60) NULL;
ALTER TABLE resoluciones MODIFY COLUMN resultado VARCHAR(60) NULL;
ALTER TABLE resoluciones MODIFY COLUMN numero_resolucion VARCHAR(120) NULL;

-- Estructura TTAIP idempotente: expediente agregado, salas, cédulas y notificaciones.
DROP PROCEDURE IF EXISTS add_column_if_missing;
DELIMITER //
CREATE PROCEDURE add_column_if_missing(IN p_table VARCHAR(64), IN p_column VARCHAR(64), IN p_definition TEXT)
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = p_table
          AND COLUMN_NAME = p_column
    ) THEN
        SET @ddl = CONCAT('ALTER TABLE ', p_table, ' ADD COLUMN ', p_column, ' ', p_definition);
        PREPARE stmt FROM @ddl;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END//
DELIMITER ;

CALL add_column_if_missing('miembros_ttaip', 'periodo_inicio', 'DATE NULL');
CALL add_column_if_missing('miembros_ttaip', 'periodo_fin', 'DATE NULL');
CALL add_column_if_missing('miembros_ttaip', 'presidente_tribunal', 'TINYINT(1) NULL DEFAULT 0');
CALL add_column_if_missing('resoluciones', 'id_expediente_ttaip', 'BIGINT NULL');
CALL add_column_if_missing('resoluciones', 'id_sala_ttaip', 'BIGINT NULL');

DROP PROCEDURE IF EXISTS add_column_if_missing;

CREATE TABLE IF NOT EXISTS salas_ttaip (
    id_sala_ttaip BIGINT NOT NULL AUTO_INCREMENT,
    nombre VARCHAR(40) NOT NULL,
    periodo_inicio DATE NOT NULL,
    periodo_fin DATE NOT NULL,
    id_presidente_sala BIGINT NULL,
    activa TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (id_sala_ttaip),
    UNIQUE KEY uk_salas_ttaip_nombre (nombre),
    KEY idx_sala_ttaip_presidente (id_presidente_sala),
    CONSTRAINT fk_sala_ttaip_presidente FOREIGN KEY (id_presidente_sala) REFERENCES miembros_ttaip (id_usuario)
);

CREATE TABLE IF NOT EXISTS expedientes_ttaip (
    id_expediente_ttaip BIGINT NOT NULL AUTO_INCREMENT,
    numero_expediente VARCHAR(50) NOT NULL,
    id_apelacion BIGINT NOT NULL,
    id_sala_ttaip BIGINT NOT NULL,
    estado VARCHAR(40) NOT NULL,
    fecha_apertura DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME NULL,
    fecha_primera_calificacion DATETIME NULL,
    fecha_segunda_calificacion DATETIME NULL,
    fecha_resolucion_final DATETIME NULL,
    fecha_limite_resolucion DATE NULL,
    trazabilidad_minima TEXT NULL,
    PRIMARY KEY (id_expediente_ttaip),
    UNIQUE KEY uk_expedientes_ttaip_numero (numero_expediente),
    UNIQUE KEY uk_expedientes_ttaip_apelacion (id_apelacion),
    KEY idx_expedientes_ttaip_sala (id_sala_ttaip),
    KEY idx_expedientes_ttaip_estado (estado),
    CONSTRAINT fk_expediente_ttaip_apelacion FOREIGN KEY (id_apelacion) REFERENCES apelaciones (id_apelacion),
    CONSTRAINT fk_expediente_ttaip_sala FOREIGN KEY (id_sala_ttaip) REFERENCES salas_ttaip (id_sala_ttaip)
);

CREATE TABLE IF NOT EXISTS expediente_ttaip_miembros (
    id_expediente_ttaip BIGINT NOT NULL,
    id_miembro_ttaip BIGINT NOT NULL,
    PRIMARY KEY (id_expediente_ttaip, id_miembro_ttaip),
    KEY idx_expediente_miembro_ttaip_miembro (id_miembro_ttaip),
    CONSTRAINT fk_expediente_miembro_ttaip_expediente FOREIGN KEY (id_expediente_ttaip) REFERENCES expedientes_ttaip (id_expediente_ttaip),
    CONSTRAINT fk_expediente_miembro_ttaip_miembro FOREIGN KEY (id_miembro_ttaip) REFERENCES miembros_ttaip (id_usuario)
);

CREATE TABLE IF NOT EXISTS cedulas_notificacion (
    id_cedula BIGINT NOT NULL AUTO_INCREMENT,
    id_resolucion BIGINT NOT NULL,
    numero_cedula VARCHAR(50) NOT NULL,
    destinatario VARCHAR(30) NOT NULL,
    destinatario_nombre VARCHAR(200) NULL,
    destinatario_email VARCHAR(150) NULL,
    fecha_emision DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    canal VARCHAR(40) NULL DEFAULT 'CASILLA_ELECTRONICA',
    estado VARCHAR(40) NULL DEFAULT 'EMITIDA',
    documento_referencia VARCHAR(500) NULL,
    PRIMARY KEY (id_cedula),
    UNIQUE KEY uk_cedula_numero_destinatario (numero_cedula, destinatario),
    KEY idx_cedula_resolucion (id_resolucion),
    CONSTRAINT fk_cedula_resolucion FOREIGN KEY (id_resolucion) REFERENCES resoluciones (id_resolucion)
);

CREATE TABLE IF NOT EXISTS notificaciones_ttaip (
    id_notificacion BIGINT NOT NULL AUTO_INCREMENT,
    id_expediente_ttaip BIGINT NOT NULL,
    id_cedula BIGINT NOT NULL,
    destinatario VARCHAR(30) NOT NULL,
    destinatario_nombre VARCHAR(200) NULL,
    destinatario_email VARCHAR(150) NULL,
    fecha_notificacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    medio VARCHAR(40) NULL DEFAULT 'CASILLA_ELECTRONICA',
    estado VARCHAR(40) NULL DEFAULT 'NOTIFICADA',
    detalle TEXT NULL,
    PRIMARY KEY (id_notificacion),
    UNIQUE KEY uk_notificacion_cedula (id_cedula),
    KEY idx_notificacion_expediente (id_expediente_ttaip),
    KEY idx_notificacion_destinatario (destinatario),
    CONSTRAINT fk_notificacion_expediente FOREIGN KEY (id_expediente_ttaip) REFERENCES expedientes_ttaip (id_expediente_ttaip),
    CONSTRAINT fk_notificacion_cedula FOREIGN KEY (id_cedula) REFERENCES cedulas_notificacion (id_cedula)
);

CREATE TABLE IF NOT EXISTS historial_ttaip (
    id_historial BIGINT NOT NULL AUTO_INCREMENT,
    id_expediente_ttaip BIGINT NOT NULL,
    tipo_evento VARCHAR(40) NOT NULL,
    descripcion TEXT NOT NULL,
    estado_anterior VARCHAR(60) NULL,
    estado_nuevo VARCHAR(60) NULL,
    actor VARCHAR(120) NULL DEFAULT 'SISTEMA',
    referencia VARCHAR(180) NULL,
    fecha_evento DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_historial),
    KEY idx_historial_ttaip_expediente (id_expediente_ttaip),
    KEY idx_historial_ttaip_tipo (tipo_evento),
    KEY idx_historial_ttaip_fecha (fecha_evento),
    CONSTRAINT fk_historial_ttaip_expediente FOREIGN KEY (id_expediente_ttaip) REFERENCES expedientes_ttaip (id_expediente_ttaip)
);

CREATE TABLE IF NOT EXISTS reprocesos_notificacion (
    id_reproceso BIGINT NOT NULL AUTO_INCREMENT,
    id_expediente_ttaip BIGINT NOT NULL,
    id_notificacion BIGINT NULL,
    id_cedula_original BIGINT NOT NULL,
    id_reproceso_padre BIGINT NULL,
    destinatario VARCHAR(30) NOT NULL,
    numero_cedula_original VARCHAR(50) NOT NULL,
    fecha_ingreso_cargo DATE NULL,
    observacion_reproceso TEXT NULL,
    fecha_subsanacion DATE NULL,
    cedula_subsanacion VARCHAR(50) NULL,
    fecha_cedula_subsanacion DATE NULL,
    numero_intento INT NOT NULL DEFAULT 1,
    estado VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
    responsable_notificacion VARCHAR(120) NULL,
    responsable_subsanacion VARCHAR(120) NULL,
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id_reproceso),
    UNIQUE KEY uk_reproceso_cedula_destinatario_intento (id_cedula_original, destinatario, numero_intento),
    KEY idx_reproceso_expediente (id_expediente_ttaip),
    KEY idx_reproceso_cedula (id_cedula_original),
    KEY idx_reproceso_destinatario (destinatario),
    KEY idx_reproceso_estado (estado),
    KEY idx_reproceso_notificacion (id_notificacion),
    KEY idx_reproceso_padre (id_reproceso_padre),
    CONSTRAINT fk_reproceso_expediente FOREIGN KEY (id_expediente_ttaip) REFERENCES expedientes_ttaip (id_expediente_ttaip),
    CONSTRAINT fk_reproceso_notificacion FOREIGN KEY (id_notificacion) REFERENCES notificaciones_ttaip (id_notificacion),
    CONSTRAINT fk_reproceso_cedula FOREIGN KEY (id_cedula_original) REFERENCES cedulas_notificacion (id_cedula),
    CONSTRAINT fk_reproceso_padre FOREIGN KEY (id_reproceso_padre) REFERENCES reprocesos_notificacion (id_reproceso)
);

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
-- 3) Presidencia y miembros reales TTAIP - acceso frontend: /acceso-ttaip
-- -----------------------------------------------------------------------------
INSERT INTO usuarios (email, password, tipo_usuario, fecha_registro, activo)
VALUES ('tvalverde@minjus.gob.pe', 'Saip2026*', 'TTAIP', NOW(), TRUE),
       ('lagurto@minjus.gob.pe', 'Saip2026*', 'TTAIP', NOW(), TRUE),
       ('szamora@minjus.gob.pe', 'Saip2026*', 'TTAIP', NOW(), TRUE),
       ('jpichon@minjus.gob.pe', 'Saip2026*', 'TTAIP', NOW(), TRUE),
       ('jmancilla@minjus.gob.pe', 'Saip2026*', 'TTAIP', NOW(), TRUE),
       ('jrojasb@minjus.gob.pe', 'Saip2026*', 'TTAIP', NOW(), TRUE)
ON DUPLICATE KEY UPDATE password     = VALUES(password),
                        tipo_usuario = VALUES(tipo_usuario),
                        activo       = VALUES(activo);

INSERT INTO miembros_ttaip (id_usuario, nombre_completo, cargo, sala, especialidad, periodo_inicio, periodo_fin, presidente_tribunal)
SELECT u.id_usuario,
       t.nombre_completo,
       t.cargo,
       t.sala,
       t.especialidad,
       t.periodo_inicio,
       t.periodo_fin,
       t.presidente_tribunal
FROM (SELECT 'tvalverde@minjus.gob.pe'            AS email,
             'Tatiana Azucena Valverde Alvarado' AS nombre_completo,
             'Presidenta'                        AS cargo,
             'PRIMERA SALA'                      AS sala,
             'Derecho administrativo'            AS especialidad,
             DATE '2025-03-22'                   AS periodo_inicio,
             DATE '2026-03-21'                   AS periodo_fin,
             FALSE                               AS presidente_tribunal
      UNION ALL
      SELECT 'lagurto@minjus.gob.pe',
             'Luis Guillermo Agurto Villegas',
             'Vocal',
             'PRIMERA SALA',
             'Transparencia y acceso a la informacion',
             DATE '2025-03-22',
             DATE '2026-03-21',
             FALSE
      UNION ALL
      SELECT 'szamora@minjus.gob.pe',
             'Segundo Ulises Zamora Barboza',
             'Vocal',
             'PRIMERA SALA',
             'Gestion publica',
             DATE '2025-03-22',
             DATE '2026-03-21',
             FALSE
      UNION ALL
      SELECT 'jpichon@minjus.gob.pe',
             'Junior Pichon De la Cruz',
             'Presidente',
             'SEGUNDA SALA',
             'Procedimiento administrativo',
             DATE '2025-06-04',
             DATE '2026-06-03',
             FALSE
      UNION ALL
      SELECT 'jmancilla@minjus.gob.pe',
             'Julio Cesar Mancilla Crespo',
             'Vocal',
             'SEGUNDA SALA',
             'Derecho constitucional',
             DATE '2025-06-09',
             DATE '2026-06-08',
             TRUE
      UNION ALL
      SELECT 'jrojasb@minjus.gob.pe',
             'Jessica Martha Rojas Barrueta',
             'Vocal',
             'SEGUNDA SALA',
             'Proteccion de datos',
             DATE '2025-06-04',
             DATE '2026-06-03',
             FALSE) t
         JOIN usuarios u ON u.email = t.email
ON DUPLICATE KEY UPDATE nombre_completo = VALUES(nombre_completo),
                        cargo           = VALUES(cargo),
                        sala            = VALUES(sala),
                        especialidad    = VALUES(especialidad),
                        periodo_inicio  = VALUES(periodo_inicio),
                        periodo_fin     = VALUES(periodo_fin),
                        presidente_tribunal = VALUES(presidente_tribunal);

UPDATE usuarios u
    JOIN miembros_ttaip mt ON mt.id_usuario = u.id_usuario
SET u.activo = FALSE
WHERE u.tipo_usuario = 'TTAIP'
  AND u.email NOT IN ('tvalverde@minjus.gob.pe', 'lagurto@minjus.gob.pe', 'szamora@minjus.gob.pe',
                      'jpichon@minjus.gob.pe', 'jmancilla@minjus.gob.pe', 'jrojasb@minjus.gob.pe');

INSERT INTO salas_ttaip (nombre, periodo_inicio, periodo_fin, id_presidente_sala, activa)
SELECT 'PRIMERA SALA',
       DATE '2025-03-22',
       DATE '2026-03-21',
       (SELECT u.id_usuario FROM usuarios u WHERE u.email = 'tvalverde@minjus.gob.pe'),
       TRUE
ON DUPLICATE KEY UPDATE periodo_inicio = VALUES(periodo_inicio),
                        periodo_fin = VALUES(periodo_fin),
                        id_presidente_sala = VALUES(id_presidente_sala),
                        activa = VALUES(activa);

INSERT INTO salas_ttaip (nombre, periodo_inicio, periodo_fin, id_presidente_sala, activa)
SELECT 'SEGUNDA SALA',
       DATE '2025-06-04',
       DATE '2026-06-03',
       (SELECT u.id_usuario FROM usuarios u WHERE u.email = 'jpichon@minjus.gob.pe'),
       TRUE
ON DUPLICATE KEY UPDATE periodo_inicio = VALUES(periodo_inicio),
                        periodo_fin = VALUES(periodo_fin),
                        id_presidente_sala = VALUES(id_presidente_sala),
                        activa = VALUES(activa);

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

INSERT INTO apelaciones (expediente,
                         fundamentos,
                         estado,
                         resultado,
                         calificacion_primera,
                         calificacion_segunda,
                         id_solicitud,
                         id_ciudadano,
                         fecha_apelacion,
                         fecha_subsanacion,
                         dias_subsanacion)
SELECT '01562-2025-JUS/TTAIP',
       'Apelo la respuesta emitida y adjunto subsanacion para que el Tribunal emita pronunciamiento de fondo.',
       'RESUELTO_FUNDADO_EN_PARTE',
       'FUNDADO_EN_PARTE',
       'INADMISIBLE',
       'ADMITIDO',
       s.id_solicitud,
       s.id_ciudadano,
       DATE_SUB(NOW(), INTERVAL 18 DAY),
       DATE_SUB(CURDATE(), INTERVAL 12 DAY),
       2
FROM solicitudes s
WHERE s.expediente = 'SAIP-2025-00003'
  AND NOT EXISTS (SELECT 1
                  FROM apelaciones a
                  WHERE a.expediente = '01562-2025-JUS/TTAIP'
                     OR a.id_solicitud = s.id_solicitud);

UPDATE apelaciones
SET estado = 'EN_RESOLUCION',
    calificacion_primera = 'ADMISIBLE'
WHERE expediente = '01560-2025-JUS/TTAIP';

UPDATE apelaciones
SET estado = 'EN_CALIFICACION_2',
    calificacion_primera = 'INADMISIBLE',
    fecha_subsanacion = COALESCE(fecha_subsanacion, CURDATE()),
    dias_subsanacion = COALESCE(dias_subsanacion, 2)
WHERE expediente = '01561-2025-JUS/TTAIP';

-- Expediente TTAIP como agregado principal: apelacion -> sala -> miembros -> resoluciones.
INSERT INTO expedientes_ttaip (numero_expediente,
                               id_apelacion,
                               id_sala_ttaip,
                               estado,
                               fecha_apertura,
                               fecha_actualizacion,
                               fecha_primera_calificacion,
                               fecha_segunda_calificacion,
                               fecha_resolucion_final,
                               fecha_limite_resolucion,
                               trazabilidad_minima)
SELECT a.expediente,
       a.id_apelacion,
       st.id_sala_ttaip,
       a.estado,
       a.fecha_apelacion,
       NOW(),
       CASE WHEN a.expediente IN ('01560-2025-JUS/TTAIP', '01561-2025-JUS/TTAIP', '01562-2025-JUS/TTAIP')
            THEN DATE_ADD(a.fecha_apelacion, INTERVAL 2 DAY) ELSE NULL END,
       CASE WHEN a.expediente = '01562-2025-JUS/TTAIP'
            THEN DATE_ADD(a.fecha_apelacion, INTERVAL 7 DAY) ELSE NULL END,
       CASE WHEN a.expediente = '01562-2025-JUS/TTAIP'
            THEN DATE_ADD(a.fecha_apelacion, INTERVAL 14 DAY) ELSE NULL END,
       CASE WHEN a.expediente IN ('01561-2025-JUS/TTAIP', '01562-2025-JUS/TTAIP')
            THEN DATE_ADD(CURDATE(), INTERVAL 10 DAY) ELSE NULL END,
       CONCAT(DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s'), ' - Expediente TTAIP abierto sin etapa de elevacion; sala asignada: ', st.nombre)
FROM apelaciones a
         JOIN (SELECT '01560-2025-JUS/TTAIP' AS expediente, 'PRIMERA SALA' AS sala
               UNION ALL SELECT '01561-2025-JUS/TTAIP', 'SEGUNDA SALA'
               UNION ALL SELECT '01562-2025-JUS/TTAIP', 'SEGUNDA SALA') map ON map.expediente = a.expediente
         JOIN salas_ttaip st ON st.nombre = map.sala
ON DUPLICATE KEY UPDATE id_apelacion = VALUES(id_apelacion),
                        id_sala_ttaip = VALUES(id_sala_ttaip),
                        estado = VALUES(estado),
                        fecha_actualizacion = VALUES(fecha_actualizacion),
                        fecha_primera_calificacion = VALUES(fecha_primera_calificacion),
                        fecha_segunda_calificacion = VALUES(fecha_segunda_calificacion),
                        fecha_resolucion_final = VALUES(fecha_resolucion_final),
                        fecha_limite_resolucion = VALUES(fecha_limite_resolucion),
                        trazabilidad_minima = VALUES(trazabilidad_minima);

INSERT IGNORE INTO expediente_ttaip_miembros (id_expediente_ttaip, id_miembro_ttaip)
SELECT et.id_expediente_ttaip, mt.id_usuario
FROM expedientes_ttaip et
         JOIN salas_ttaip st ON st.id_sala_ttaip = et.id_sala_ttaip
         JOIN miembros_ttaip mt ON mt.sala = st.nombre
WHERE et.numero_expediente IN ('01560-2025-JUS/TTAIP', '01561-2025-JUS/TTAIP', '01562-2025-JUS/TTAIP');

-- Resoluciones de prueba: la resolucion incluye sala; la cedula mantiene JUS/TTAIP sin sufijo de sala.
INSERT INTO resoluciones (id_apelacion,
                          id_expediente_ttaip,
                          id_sala_ttaip,
                          id_miembro_ttaip,
                          tipo_resolucion,
                          decision,
                          fundamentos,
                          fundamento_legal,
                          fecha_resolucion,
                          numero_resolucion,
                          observaciones,
                          resultado,
                          iniciar_proceso_disciplinario)
SELECT a.id_apelacion,
       et.id_expediente_ttaip,
       st.id_sala_ttaip,
       mt.id_usuario,
       r.tipo_resolucion,
       r.decision,
       r.fundamentos,
       r.fundamento_legal,
       r.fecha_resolucion,
       r.numero_resolucion,
       r.observaciones,
       r.resultado,
       r.iniciar_proceso_disciplinario
FROM (SELECT '01560-2025-JUS/TTAIP' AS expediente,
             'tvalverde@minjus.gob.pe' AS email_miembro,
             'PRIMERA_CALIFICACION' AS tipo_resolucion,
             'ADMISIBLE' AS decision,
             'La apelacion cumple requisitos formales y pasa a resolucion final.' AS fundamentos,
             'Ley N. 27806 y Reglamento del TTAIP.' AS fundamento_legal,
             DATE_SUB(NOW(), INTERVAL 1 DAY) AS fecha_resolucion,
             'RESOLUCIÓN N.° 001595-2025-JUS/TTAIP-PRIMERA SALA' AS numero_resolucion,
             'Primera calificacion emitida por la Primera Sala.' AS observaciones,
             NULL AS resultado,
             FALSE AS iniciar_proceso_disciplinario
      UNION ALL
      SELECT '01561-2025-JUS/TTAIP',
             'jpichon@minjus.gob.pe',
             'PRIMERA_CALIFICACION',
             'INADMISIBLE',
             'Se requiere subsanacion del recurso dentro del plazo legal.',
             'Reglas de admisibilidad del procedimiento TTAIP.',
             DATE_SUB(NOW(), INTERVAL 3 DAY),
             'RESOLUCIÓN N.° 002010-2025-JUS/TTAIP-SEGUNDA SALA',
             'Primera calificacion emitida por la Segunda Sala.',
             NULL,
             FALSE
      UNION ALL
      SELECT '01562-2025-JUS/TTAIP',
             'jpichon@minjus.gob.pe',
             'PRIMERA_CALIFICACION',
             'INADMISIBLE',
             'El recurso fue observado y se notifico plazo de subsanacion.',
             'Reglas de admisibilidad del procedimiento TTAIP.',
             DATE_SUB(NOW(), INTERVAL 16 DAY),
             'RESOLUCIÓN N.° 002100-2025-JUS/TTAIP-SEGUNDA SALA',
             'Primera calificacion con observaciones subsanables.',
             NULL,
             FALSE
      UNION ALL
      SELECT '01562-2025-JUS/TTAIP',
             'jpichon@minjus.gob.pe',
             'SEGUNDA_CALIFICACION',
             'ADMITIDO',
             'La subsanacion presentada cumple las observaciones formuladas.',
             'Reglas de admisibilidad del procedimiento TTAIP.',
             DATE_SUB(NOW(), INTERVAL 11 DAY),
             'RESOLUCIÓN N.° 002101-2025-JUS/TTAIP-SEGUNDA SALA',
             'Segunda calificacion emitida y notificada antes del plazo de resolucion final.',
             NULL,
             FALSE
      UNION ALL
      SELECT '01562-2025-JUS/TTAIP',
             'jmancilla@minjus.gob.pe',
             'RESOLUCION_FINAL',
             'FUNDADO_EN_PARTE',
             'El Tribunal declara fundado en parte el recurso y ordena entregar la informacion publica no exceptuada.',
             'Ley N. 27806, jurisprudencia administrativa y Reglamento del TTAIP.',
             DATE_SUB(NOW(), INTERVAL 4 DAY),
             'RESOLUCIÓN N.° 002102-2025-JUS/TTAIP-SEGUNDA SALA',
             'Resolucion final emitida por la Segunda Sala.',
             'FUNDADO_EN_PARTE',
             TRUE) r
         JOIN apelaciones a ON a.expediente = r.expediente
         JOIN expedientes_ttaip et ON et.numero_expediente = a.expediente
         JOIN salas_ttaip st ON st.id_sala_ttaip = et.id_sala_ttaip
         JOIN usuarios u ON u.email = r.email_miembro
         JOIN miembros_ttaip mt ON mt.id_usuario = u.id_usuario
ON DUPLICATE KEY UPDATE id_apelacion = VALUES(id_apelacion),
                        id_expediente_ttaip = VALUES(id_expediente_ttaip),
                        id_sala_ttaip = VALUES(id_sala_ttaip),
                        id_miembro_ttaip = VALUES(id_miembro_ttaip),
                        tipo_resolucion = VALUES(tipo_resolucion),
                        decision = VALUES(decision),
                        fundamentos = VALUES(fundamentos),
                        fundamento_legal = VALUES(fundamento_legal),
                        fecha_resolucion = VALUES(fecha_resolucion),
                        observaciones = VALUES(observaciones),
                        resultado = VALUES(resultado),
                        iniciar_proceso_disciplinario = VALUES(iniciar_proceso_disciplinario);

INSERT INTO cedulas_notificacion (id_resolucion,
                                  numero_cedula,
                                  destinatario,
                                  destinatario_nombre,
                                  destinatario_email,
                                  fecha_emision,
                                  canal,
                                  estado,
                                  documento_referencia)
SELECT r.id_resolucion,
       c.numero_cedula,
       c.destinatario,
       CASE WHEN c.destinatario = 'CIUDADANO' THEN ci.nombre_completo ELSE e.nombre END,
       CASE WHEN c.destinatario = 'CIUDADANO' THEN uci.email ELSE e.email END,
       c.fecha_emision,
       'CASILLA_ELECTRONICA',
       'EMITIDA',
       CONCAT('CÉDULA DE NOTIFICACIÓN N.° ', c.numero_cedula)
FROM (SELECT 'RESOLUCIÓN N.° 001595-2025-JUS/TTAIP-PRIMERA SALA' AS numero_resolucion,
             '15203-2025-JUS/TTAIP' AS numero_cedula,
             'CIUDADANO' AS destinatario,
             DATE_SUB(NOW(), INTERVAL 1 DAY) AS fecha_emision
      UNION ALL SELECT 'RESOLUCIÓN N.° 001595-2025-JUS/TTAIP-PRIMERA SALA', '15203-2025-JUS/TTAIP', 'ENTIDAD_PUBLICA', DATE_SUB(NOW(), INTERVAL 1 DAY)
      UNION ALL SELECT 'RESOLUCIÓN N.° 002010-2025-JUS/TTAIP-SEGUNDA SALA', '15204-2025-JUS/TTAIP', 'CIUDADANO', DATE_SUB(NOW(), INTERVAL 3 DAY)
      UNION ALL SELECT 'RESOLUCIÓN N.° 002010-2025-JUS/TTAIP-SEGUNDA SALA', '15204-2025-JUS/TTAIP', 'ENTIDAD_PUBLICA', DATE_SUB(NOW(), INTERVAL 3 DAY)
      UNION ALL SELECT 'RESOLUCIÓN N.° 002100-2025-JUS/TTAIP-SEGUNDA SALA', '15205-2025-JUS/TTAIP', 'CIUDADANO', DATE_SUB(NOW(), INTERVAL 16 DAY)
      UNION ALL SELECT 'RESOLUCIÓN N.° 002100-2025-JUS/TTAIP-SEGUNDA SALA', '15205-2025-JUS/TTAIP', 'ENTIDAD_PUBLICA', DATE_SUB(NOW(), INTERVAL 16 DAY)
      UNION ALL SELECT 'RESOLUCIÓN N.° 002101-2025-JUS/TTAIP-SEGUNDA SALA', '15206-2025-JUS/TTAIP', 'CIUDADANO', DATE_SUB(NOW(), INTERVAL 11 DAY)
      UNION ALL SELECT 'RESOLUCIÓN N.° 002101-2025-JUS/TTAIP-SEGUNDA SALA', '15206-2025-JUS/TTAIP', 'ENTIDAD_PUBLICA', DATE_SUB(NOW(), INTERVAL 11 DAY)
      UNION ALL SELECT 'RESOLUCIÓN N.° 002102-2025-JUS/TTAIP-SEGUNDA SALA', '15207-2025-JUS/TTAIP', 'CIUDADANO', DATE_SUB(NOW(), INTERVAL 4 DAY)
      UNION ALL SELECT 'RESOLUCIÓN N.° 002102-2025-JUS/TTAIP-SEGUNDA SALA', '15207-2025-JUS/TTAIP', 'ENTIDAD_PUBLICA', DATE_SUB(NOW(), INTERVAL 4 DAY)) c
         JOIN resoluciones r ON r.numero_resolucion = c.numero_resolucion
         JOIN apelaciones a ON a.id_apelacion = r.id_apelacion
         JOIN ciudadanos ci ON ci.id_usuario = a.id_ciudadano
         JOIN usuarios uci ON uci.id_usuario = ci.id_usuario
         JOIN solicitudes s ON s.id_solicitud = a.id_solicitud
         JOIN entidades e ON e.id_entidad = s.id_entidad
ON DUPLICATE KEY UPDATE id_resolucion = VALUES(id_resolucion),
                        destinatario_nombre = VALUES(destinatario_nombre),
                        destinatario_email = VALUES(destinatario_email),
                        fecha_emision = VALUES(fecha_emision),
                        canal = VALUES(canal),
                        estado = VALUES(estado),
                        documento_referencia = VALUES(documento_referencia);

INSERT INTO notificaciones_ttaip (id_expediente_ttaip,
                                  id_cedula,
                                  destinatario,
                                  destinatario_nombre,
                                  destinatario_email,
                                  fecha_notificacion,
                                  medio,
                                  estado,
                                  detalle)
SELECT et.id_expediente_ttaip,
       cn.id_cedula,
       cn.destinatario,
       cn.destinatario_nombre,
       cn.destinatario_email,
       cn.fecha_emision,
       'CASILLA_ELECTRONICA',
       'NOTIFICADA',
       CONCAT('Notificacion oficial de ', r.numero_resolucion, ' para ', cn.destinatario)
FROM cedulas_notificacion cn
         JOIN resoluciones r ON r.id_resolucion = cn.id_resolucion
         JOIN expedientes_ttaip et ON et.id_expediente_ttaip = r.id_expediente_ttaip
WHERE r.numero_resolucion IN ('RESOLUCIÓN N.° 001595-2025-JUS/TTAIP-PRIMERA SALA',
                              'RESOLUCIÓN N.° 002010-2025-JUS/TTAIP-SEGUNDA SALA',
                              'RESOLUCIÓN N.° 002100-2025-JUS/TTAIP-SEGUNDA SALA',
                              'RESOLUCIÓN N.° 002101-2025-JUS/TTAIP-SEGUNDA SALA',
                              'RESOLUCIÓN N.° 002102-2025-JUS/TTAIP-SEGUNDA SALA')
ON DUPLICATE KEY UPDATE id_expediente_ttaip = VALUES(id_expediente_ttaip),
                        destinatario = VALUES(destinatario),
                        destinatario_nombre = VALUES(destinatario_nombre),
                        destinatario_email = VALUES(destinatario_email),
                        fecha_notificacion = VALUES(fecha_notificacion),
                        medio = VALUES(medio),
                        estado = VALUES(estado),
                        detalle = VALUES(detalle);

-- Historial estructurado del expediente TTAIP: evita depender solo de texto libre.
INSERT INTO historial_ttaip (id_expediente_ttaip,
                             tipo_evento,
                             descripcion,
                             estado_anterior,
                             estado_nuevo,
                             actor,
                             referencia,
                             fecha_evento)
SELECT et.id_expediente_ttaip,
       'APERTURA_EXPEDIENTE',
       CONCAT('Expediente TTAIP abierto sin etapa de elevacion; sala asignada: ', st.nombre),
       NULL,
       et.estado,
       'SISTEMA',
       et.numero_expediente,
       COALESCE(et.fecha_apertura, NOW())
FROM expedientes_ttaip et
         JOIN salas_ttaip st ON st.id_sala_ttaip = et.id_sala_ttaip
WHERE NOT EXISTS (SELECT 1
                  FROM historial_ttaip h
                  WHERE h.id_expediente_ttaip = et.id_expediente_ttaip
                    AND h.tipo_evento = 'APERTURA_EXPEDIENTE'
                    AND h.referencia = et.numero_expediente);

INSERT INTO historial_ttaip (id_expediente_ttaip,
                             tipo_evento,
                             descripcion,
                             estado_anterior,
                             estado_nuevo,
                             actor,
                             referencia,
                             fecha_evento)
SELECT et.id_expediente_ttaip,
       'RESOLUCION_EMITIDA',
       CONCAT(r.tipo_resolucion, ' registrada por ', st.nombre),
       NULL,
       et.estado,
       'TTAIP',
       r.numero_resolucion,
       COALESCE(r.fecha_resolucion, NOW())
FROM resoluciones r
         JOIN expedientes_ttaip et ON et.id_expediente_ttaip = r.id_expediente_ttaip
         JOIN salas_ttaip st ON st.id_sala_ttaip = et.id_sala_ttaip
WHERE r.numero_resolucion IS NOT NULL
  AND NOT EXISTS (SELECT 1
                  FROM historial_ttaip h
                  WHERE h.id_expediente_ttaip = et.id_expediente_ttaip
                    AND h.tipo_evento = 'RESOLUCION_EMITIDA'
                    AND h.referencia = r.numero_resolucion);

INSERT INTO historial_ttaip (id_expediente_ttaip,
                             tipo_evento,
                             descripcion,
                             estado_anterior,
                             estado_nuevo,
                             actor,
                             referencia,
                             fecha_evento)
SELECT et.id_expediente_ttaip,
       'CEDULA_EMITIDA',
       CONCAT('Cedula emitida para ', CASE WHEN cn.destinatario = 'CIUDADANO' THEN 'ciudadano' ELSE 'entidad publica' END,
              ' por ', r.numero_resolucion),
       NULL,
       et.estado,
       'TTAIP',
       CONCAT(cn.numero_cedula, ':', cn.destinatario),
       COALESCE(cn.fecha_emision, NOW())
FROM cedulas_notificacion cn
         JOIN resoluciones r ON r.id_resolucion = cn.id_resolucion
         JOIN expedientes_ttaip et ON et.id_expediente_ttaip = r.id_expediente_ttaip
WHERE NOT EXISTS (SELECT 1
                  FROM historial_ttaip h
                  WHERE h.id_expediente_ttaip = et.id_expediente_ttaip
                    AND h.tipo_evento = 'CEDULA_EMITIDA'
                    AND h.referencia = CONCAT(cn.numero_cedula, ':', cn.destinatario));

INSERT INTO historial_ttaip (id_expediente_ttaip,
                             tipo_evento,
                             descripcion,
                             estado_anterior,
                             estado_nuevo,
                             actor,
                             referencia,
                             fecha_evento)
SELECT n.id_expediente_ttaip,
       'NOTIFICACION_REGISTRADA',
       CONCAT('Notificacion registrada para ', CASE WHEN n.destinatario = 'CIUDADANO' THEN 'ciudadano' ELSE 'entidad publica' END),
       NULL,
       et.estado,
       'TTAIP',
       CONCAT('NOTIFICACION-', cn.numero_cedula, ':', n.destinatario),
       COALESCE(n.fecha_notificacion, NOW())
FROM notificaciones_ttaip n
         JOIN expedientes_ttaip et ON et.id_expediente_ttaip = n.id_expediente_ttaip
         JOIN cedulas_notificacion cn ON cn.id_cedula = n.id_cedula
WHERE NOT EXISTS (SELECT 1
                  FROM historial_ttaip h
                  WHERE h.id_expediente_ttaip = n.id_expediente_ttaip
                    AND h.tipo_evento = 'NOTIFICACION_REGISTRADA'
                    AND h.referencia = CONCAT('NOTIFICACION-', cn.numero_cedula, ':', n.destinatario));

-- Reproceso de notificacion de prueba alineado con la referencia SQL Server.
INSERT INTO reprocesos_notificacion (id_expediente_ttaip,
                                     id_notificacion,
                                     id_cedula_original,
                                     destinatario,
                                     numero_cedula_original,
                                     fecha_ingreso_cargo,
                                     observacion_reproceso,
                                     numero_intento,
                                     estado,
                                     responsable_notificacion,
                                     fecha_creacion,
                                     fecha_actualizacion)
SELECT et.id_expediente_ttaip,
       n.id_notificacion,
       cn.id_cedula,
       cn.destinatario,
       cn.numero_cedula,
       DATE(COALESCE(n.fecha_notificacion, cn.fecha_emision)),
       'Cargo de notificacion observado; requiere reproceso de cedula a entidad publica.',
       1,
       'PENDIENTE',
       'Mesa de Partes TTAIP',
       NOW(),
       NOW()
FROM cedulas_notificacion cn
         JOIN resoluciones r ON r.id_resolucion = cn.id_resolucion
         JOIN expedientes_ttaip et ON et.id_expediente_ttaip = r.id_expediente_ttaip
         LEFT JOIN notificaciones_ttaip n ON n.id_cedula = cn.id_cedula
WHERE cn.numero_cedula = '15204-2025-JUS/TTAIP'
  AND cn.destinatario = 'ENTIDAD_PUBLICA'
  AND NOT EXISTS (SELECT 1
                  FROM reprocesos_notificacion rp
                  WHERE rp.id_cedula_original = cn.id_cedula
                    AND rp.destinatario = cn.destinatario
                    AND rp.numero_intento = 1);

INSERT INTO historial_ttaip (id_expediente_ttaip,
                             tipo_evento,
                             descripcion,
                             estado_anterior,
                             estado_nuevo,
                             actor,
                             referencia,
                             fecha_evento)
SELECT rp.id_expediente_ttaip,
       'REPROCESO_REGISTRADO',
       CONCAT('Reproceso de notificacion registrado para ', CASE WHEN rp.destinatario = 'CIUDADANO' THEN 'ciudadano' ELSE 'entidad publica' END),
       NULL,
       et.estado,
       COALESCE(rp.responsable_notificacion, 'TTAIP'),
       CONCAT('REPROCESO-', rp.numero_cedula_original, ':', rp.destinatario, ':', rp.numero_intento),
       COALESCE(rp.fecha_creacion, NOW())
FROM reprocesos_notificacion rp
         JOIN expedientes_ttaip et ON et.id_expediente_ttaip = rp.id_expediente_ttaip
WHERE NOT EXISTS (SELECT 1
                  FROM historial_ttaip h
                  WHERE h.id_expediente_ttaip = rp.id_expediente_ttaip
                    AND h.tipo_evento = 'REPROCESO_REGISTRADO'
                    AND h.referencia = CONCAT('REPROCESO-', rp.numero_cedula_original, ':', rp.destinatario, ':', rp.numero_intento));

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
FROM administradores
UNION ALL
SELECT 'salas_ttaip', COUNT(*)
FROM salas_ttaip
UNION ALL
SELECT 'expedientes_ttaip', COUNT(*)
FROM expedientes_ttaip
UNION ALL
SELECT 'resoluciones', COUNT(*)
FROM resoluciones
UNION ALL
SELECT 'cedulas_notificacion', COUNT(*)
FROM cedulas_notificacion
UNION ALL
SELECT 'notificaciones_ttaip', COUNT(*)
FROM notificaciones_ttaip
UNION ALL
SELECT 'historial_ttaip', COUNT(*)
FROM historial_ttaip
UNION ALL
SELECT 'reprocesos_notificacion', COUNT(*)
FROM reprocesos_notificacion;




