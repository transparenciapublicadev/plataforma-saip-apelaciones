-- ============================================
-- Datos iniciales (seed) para desarrollo — Plataforma SAIP
-- Se ejecuta automáticamente al iniciar Spring Boot (spring.sql.init.mode=always)
-- Usa INSERT IGNORE: solo inserta si el registro no existe (datos persisten entre reinicios)
-- Password: 123456 (plaintext, se migra a BCrypt en primer login vía AuthRestController)
--
-- Orden de inserción respeta dependencias FK:
--   entidades → usuarios/subtipos
-- ============================================

-- ============================================
-- 1. ENTIDADES PÚBLICAS (4 entidades)
-- ============================================

INSERT IGNORE INTO entidades (id_entidad, nombre, acronimo, descripcion, direccion, telefono, email, estado, activa, fecha_registro)
VALUES (1, 'Entidad Nacional de Educación', 'ENEDU', 'Entidad encargada de la gestión educativa', 'Calle Del Comercio 193, San Borja, Lima', '(01) 615-5800', 'contacto@enedu.test', 'Activa', TRUE, NOW());

INSERT IGNORE INTO entidades (id_entidad, nombre, acronimo, descripcion, direccion, telefono, email, estado, activa, fecha_registro)
VALUES (2, 'Entidad Nacional de Salud', 'ENSAL', 'Entidad encargada de la salud pública', 'Av. Salaverry 801, Jesús María, Lima', '(01) 315-6600', 'contacto@ensal.test', 'Activa', TRUE, NOW());

INSERT IGNORE INTO entidades (id_entidad, nombre, acronimo, descripcion, direccion, telefono, email, estado, activa, fecha_registro)
VALUES (3, 'Municipalidad del Distrito Central', 'MDC', 'Gobierno local del distrito central', 'Jr. Conde de Superunda 141, Cercado de Lima', '(01) 632-1300', 'info@mdc.test', 'Activa', TRUE, NOW());

INSERT IGNORE INTO entidades (id_entidad, nombre, acronimo, descripcion, direccion, telefono, email, estado, activa, fecha_registro)
VALUES (4, 'Entidad de Justicia y Derechos Fundamentales', 'EJDF', 'Entidad de justicia y protección de derechos', 'Scipión Llona 350, Miraflores, Lima', '(01) 204-8020', 'consultas@ejdf.test', 'Activa', TRUE, NOW());

-- ============================================
-- 2. USUARIOS (13): 2 ciudadanos, 4 funcionarios, 6 TTAIP, 1 admin
-- ============================================

-- --- Ciudadanos ---

INSERT IGNORE INTO usuarios (id_usuario, email, password, tipo_usuario, activo, fecha_registro)
VALUES (1, 'carlos.garcia@email.com', '123456', 'CIUDADANO', TRUE, NOW());
INSERT IGNORE INTO ciudadanos (id_usuario, dni, nombre_completo, telefono, direccion)
VALUES (1, '72345678', 'Carlos García Rodríguez', '987654321', 'Av. Arequipa 1234, Lince, Lima');

INSERT IGNORE INTO usuarios (id_usuario, email, password, tipo_usuario, activo, fecha_registro)
VALUES (2, 'maria.lopez@email.com', '123456', 'CIUDADANO', TRUE, NOW());
INSERT IGNORE INTO ciudadanos (id_usuario, dni, nombre_completo, telefono, direccion)
VALUES (2, '71234567', 'María López Fernández', '912345678', 'Jr. Lampa 456, Cercado de Lima');

-- --- Funcionarios (1 por entidad) ---

INSERT IGNORE INTO usuarios (id_usuario, email, password, tipo_usuario, activo, fecha_registro)
VALUES (3, 'func.enedu@enedu.test', '123456', 'FUNCIONARIO', TRUE, NOW());
INSERT IGNORE INTO funcionarios (id_usuario, nombre_completo, cargo, area, telefono, id_entidad)
VALUES (3, 'Ana Martínez Rojas', 'Responsable de Acceso a la Información', 'Oficina de Transparencia y Acceso a la Información Pública', '(01) 615-5801', 1);

INSERT IGNORE INTO usuarios (id_usuario, email, password, tipo_usuario, activo, fecha_registro)
VALUES (4, 'func.ensal@ensal.test', '123456', 'FUNCIONARIO', TRUE, NOW());
INSERT IGNORE INTO funcionarios (id_usuario, nombre_completo, cargo, area, telefono, id_entidad)
VALUES (4, 'Roberto Sánchez Díaz', 'Funcionario Responsable de Transparencia', 'Oficina General de Transparencia y Anticorrupción', '(01) 315-6601', 2);

INSERT IGNORE INTO usuarios (id_usuario, email, password, tipo_usuario, activo, fecha_registro)
VALUES (5, 'func.mdc@mdc.test', '123456', 'FUNCIONARIO', TRUE, NOW());
INSERT IGNORE INTO funcionarios (id_usuario, nombre_completo, cargo, area, telefono, id_entidad)
VALUES (5, 'Pedro Torres Gutiérrez', 'Funcionario de Acceso a la Información', 'Gerencia de Participación Vecinal', '(01) 632-1301', 3);

INSERT IGNORE INTO usuarios (id_usuario, email, password, tipo_usuario, activo, fecha_registro)
VALUES (6, 'func.ejdf@ejdf.test', '123456', 'FUNCIONARIO', TRUE, NOW());
INSERT IGNORE INTO funcionarios (id_usuario, nombre_completo, cargo, area, telefono, id_entidad)
VALUES (6, 'Carmen Flores Paredes', 'Responsable de Transparencia', 'Dirección General de Transparencia, Acceso a la Información Pública y Protección de Datos Personales', '(01) 204-8021', 4);

-- --- Presidencia y miembros TTAIP oficiales ---

INSERT IGNORE INTO usuarios (id_usuario, email, password, tipo_usuario, activo, fecha_registro)
VALUES (7, 'tvalverde@minjus.gob.pe', 'Saip2026*', 'TTAIP', TRUE, NOW());
INSERT IGNORE INTO miembros_ttaip (id_usuario, nombre_completo, cargo, sala, especialidad, periodo_inicio, periodo_fin, presidente_tribunal)
VALUES (7, 'Tatiana Azucena Valverde Alvarado', 'Presidenta', 'PRIMERA SALA', 'Derecho administrativo', DATE '2025-03-22', DATE '2026-03-21', FALSE);

INSERT IGNORE INTO usuarios (id_usuario, email, password, tipo_usuario, activo, fecha_registro)
VALUES (8, 'lagurto@minjus.gob.pe', 'Saip2026*', 'TTAIP', TRUE, NOW());
INSERT IGNORE INTO miembros_ttaip (id_usuario, nombre_completo, cargo, sala, especialidad, periodo_inicio, periodo_fin, presidente_tribunal)
VALUES (8, 'Luis Guillermo Agurto Villegas', 'Vocal', 'PRIMERA SALA', 'Transparencia y acceso a la informacion', DATE '2025-03-22', DATE '2026-03-21', FALSE);

INSERT IGNORE INTO usuarios (id_usuario, email, password, tipo_usuario, activo, fecha_registro)
VALUES (9, 'szamora@minjus.gob.pe', 'Saip2026*', 'TTAIP', TRUE, NOW());
INSERT IGNORE INTO miembros_ttaip (id_usuario, nombre_completo, cargo, sala, especialidad, periodo_inicio, periodo_fin, presidente_tribunal)
VALUES (9, 'Segundo Ulises Zamora Barboza', 'Vocal', 'PRIMERA SALA', 'Gestion publica', DATE '2025-03-22', DATE '2026-03-21', FALSE);

INSERT IGNORE INTO usuarios (id_usuario, email, password, tipo_usuario, activo, fecha_registro)
VALUES (10, 'jpichon@minjus.gob.pe', 'Saip2026*', 'TTAIP', TRUE, NOW());
INSERT IGNORE INTO miembros_ttaip (id_usuario, nombre_completo, cargo, sala, especialidad, periodo_inicio, periodo_fin, presidente_tribunal)
VALUES (10, 'Junior Pichon De la Cruz', 'Presidente', 'SEGUNDA SALA', 'Procedimiento administrativo', DATE '2025-06-04', DATE '2026-06-03', FALSE);

INSERT IGNORE INTO usuarios (id_usuario, email, password, tipo_usuario, activo, fecha_registro)
VALUES (11, 'jmancilla@minjus.gob.pe', 'Saip2026*', 'TTAIP', TRUE, NOW());
INSERT IGNORE INTO miembros_ttaip (id_usuario, nombre_completo, cargo, sala, especialidad, periodo_inicio, periodo_fin, presidente_tribunal)
VALUES (11, 'Julio Cesar Mancilla Crespo', 'Vocal', 'SEGUNDA SALA', 'Derecho constitucional', DATE '2025-06-09', DATE '2026-06-08', TRUE);

INSERT IGNORE INTO usuarios (id_usuario, email, password, tipo_usuario, activo, fecha_registro)
VALUES (12, 'jrojasb@minjus.gob.pe', 'Saip2026*', 'TTAIP', TRUE, NOW());
INSERT IGNORE INTO miembros_ttaip (id_usuario, nombre_completo, cargo, sala, especialidad, periodo_inicio, periodo_fin, presidente_tribunal)
VALUES (12, 'Jessica Martha Rojas Barrueta', 'Vocal', 'SEGUNDA SALA', 'Proteccion de datos', DATE '2025-06-04', DATE '2026-06-03', FALSE);

INSERT IGNORE INTO usuarios (email, password, tipo_usuario, activo, fecha_registro)
VALUES ('tvalverde@minjus.gob.pe', 'Saip2026*', 'TTAIP', TRUE, NOW()),
       ('lagurto@minjus.gob.pe', 'Saip2026*', 'TTAIP', TRUE, NOW()),
       ('szamora@minjus.gob.pe', 'Saip2026*', 'TTAIP', TRUE, NOW()),
       ('jpichon@minjus.gob.pe', 'Saip2026*', 'TTAIP', TRUE, NOW()),
       ('jmancilla@minjus.gob.pe', 'Saip2026*', 'TTAIP', TRUE, NOW()),
       ('jrojasb@minjus.gob.pe', 'Saip2026*', 'TTAIP', TRUE, NOW());

INSERT IGNORE INTO miembros_ttaip (id_usuario, nombre_completo, cargo, sala, especialidad, periodo_inicio, periodo_fin, presidente_tribunal)
SELECT u.id_usuario, t.nombre_completo, t.cargo, t.sala, t.especialidad, t.periodo_inicio, t.periodo_fin, t.presidente_tribunal
FROM (SELECT 'tvalverde@minjus.gob.pe' AS email, 'Tatiana Azucena Valverde Alvarado' AS nombre_completo, 'Presidenta' AS cargo, 'PRIMERA SALA' AS sala, 'Derecho administrativo' AS especialidad, DATE '2025-03-22' AS periodo_inicio, DATE '2026-03-21' AS periodo_fin, FALSE AS presidente_tribunal
      UNION ALL SELECT 'lagurto@minjus.gob.pe', 'Luis Guillermo Agurto Villegas', 'Vocal', 'PRIMERA SALA', 'Transparencia y acceso a la informacion', DATE '2025-03-22', DATE '2026-03-21', FALSE
      UNION ALL SELECT 'szamora@minjus.gob.pe', 'Segundo Ulises Zamora Barboza', 'Vocal', 'PRIMERA SALA', 'Gestion publica', DATE '2025-03-22', DATE '2026-03-21', FALSE
      UNION ALL SELECT 'jpichon@minjus.gob.pe', 'Junior Pichon De la Cruz', 'Presidente', 'SEGUNDA SALA', 'Procedimiento administrativo', DATE '2025-06-04', DATE '2026-06-03', FALSE
      UNION ALL SELECT 'jmancilla@minjus.gob.pe', 'Julio Cesar Mancilla Crespo', 'Vocal', 'SEGUNDA SALA', 'Derecho constitucional', DATE '2025-06-09', DATE '2026-06-08', TRUE
      UNION ALL SELECT 'jrojasb@minjus.gob.pe', 'Jessica Martha Rojas Barrueta', 'Vocal', 'SEGUNDA SALA', 'Proteccion de datos', DATE '2025-06-04', DATE '2026-06-03', FALSE) t
         JOIN usuarios u ON u.email = t.email;

UPDATE usuarios
SET activo = FALSE
WHERE tipo_usuario = 'TTAIP'
  AND email NOT IN ('tvalverde@minjus.gob.pe', 'lagurto@minjus.gob.pe', 'szamora@minjus.gob.pe',
                    'jpichon@minjus.gob.pe', 'jmancilla@minjus.gob.pe', 'jrojasb@minjus.gob.pe');

INSERT IGNORE INTO salas_ttaip (nombre, periodo_inicio, periodo_fin, id_presidente_sala, activa)
SELECT 'PRIMERA SALA', DATE '2025-03-22', DATE '2026-03-21', u.id_usuario, TRUE
FROM usuarios u
WHERE u.email = 'tvalverde@minjus.gob.pe';

INSERT IGNORE INTO salas_ttaip (nombre, periodo_inicio, periodo_fin, id_presidente_sala, activa)
SELECT 'SEGUNDA SALA', DATE '2025-06-04', DATE '2026-06-03', u.id_usuario, TRUE
FROM usuarios u
WHERE u.email = 'jpichon@minjus.gob.pe';

-- --- Administrador ---

INSERT IGNORE INTO usuarios (id_usuario, email, password, tipo_usuario, activo, fecha_registro)
VALUES (13, 'admin@saip.test', '123456', 'ADMINISTRADOR', TRUE, NOW());
INSERT IGNORE INTO administradores (id_usuario, nombre_completo, rol, permisos)
VALUES (13, 'Administrador del Sistema', 'SUPER_ADMIN', 'TODOS');

-- The historical demo SAIP/TTAIP graph SAIP-2025-00001..00008 was removed
-- from automatic initialization. Those rows predated mandatory consent and
-- notification-channel capture and must not be recreated after migration
-- cleanup. Functional flows are exercised by tests and Newman runtime data.
