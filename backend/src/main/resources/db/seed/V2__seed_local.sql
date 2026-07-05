-- ---------------------------------------------------------------------------
-- Idempotent local validation seed.
-- ---------------------------------------------------------------------------

INSERT INTO entidades (nombre, acronimo, descripcion, fecha_registro, activa, direccion, telefono, email, estado)
VALUES
    ('Ministerio de Educacion', 'MINEDU', 'Entidad publica del sector educacion', CURRENT_TIMESTAMP, TRUE, 'Calle Del Comercio 193, San Borja, Lima', '014400000', 'mesa.partes@minedu.gob.pe', 'Activa'),
    ('Ministerio de Salud', 'MINSA', 'Entidad publica del sector salud', CURRENT_TIMESTAMP, TRUE, 'Av. Salaverry 801, Jesus Maria, Lima', '013150000', 'mesa.partes@minsa.gob.pe', 'Activa'),
    ('Ministerio del Interior', 'MININTER', 'Entidad publica del sector interior', CURRENT_TIMESTAMP, TRUE, 'Plaza 30 de Agosto S/N, San Isidro, Lima', '015136000', 'mesa.partes@mininter.gob.pe', 'Activa'),
    ('Ministerio de Justicia y DDHH', 'MINJUSDH', 'Entidad publica del sector justicia', CURRENT_TIMESTAMP, TRUE, 'Calle Scipion Llona 350, Miraflores, Lima', '012045000', 'mesa.partes@minjus.gob.pe', 'Activa'),
    ('Ministerio de Economia y Finanzas', 'MEF', 'Entidad publica del sector economia y finanzas', CURRENT_TIMESTAMP, TRUE, 'Jr. Junin 319, Cercado de Lima', '013112000', 'mesa.partes@mef.gob.pe', 'Activa'),
    ('Ministerio de Transportes y Comunicaciones', 'MTC', 'Entidad publica del sector transportes', CURRENT_TIMESTAMP, TRUE, 'Jr. Zorritos 1203, Cercado de Lima', '016151000', 'mesa.partes@mtc.gob.pe', 'Activa'),
    ('Ministerio de Desarrollo e Inclusion Social', 'MIDIS', 'Entidad publica del sector desarrollo social', CURRENT_TIMESTAMP, TRUE, 'Av. Paseo de la Republica 3101, San Isidro, Lima', '016313000', 'mesa.partes@midis.gob.pe', 'Activa'),
    ('Ministerio del Ambiente', 'MINAM', 'Entidad publica del sector ambiente', CURRENT_TIMESTAMP, TRUE, 'Av. Antonio Miroquesada 425, Magdalena del Mar, Lima', '016111000', 'mesa.partes@minam.gob.pe', 'Activa'),
    ('Superintendencia Nacional de Aduanas y de Administracion Tributaria', 'SUNAT', 'Entidad publica de administracion tributaria', CURRENT_TIMESTAMP, TRUE, 'Av. Garcilaso de la Vega 1472, Cercado de Lima', '016340000', 'mesa.partes@sunat.gob.pe', 'Activa'),
    ('Organismo Supervisor de Inversion Privada en Telecomunicaciones', 'OSIPTEL', 'Entidad reguladora de telecomunicaciones', CURRENT_TIMESTAMP, TRUE, 'Calle De la Prosa 136, San Borja, Lima', '012251313', 'mesa.partes@osiptel.gob.pe', 'Activa')
ON CONFLICT (acronimo) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    descripcion = EXCLUDED.descripcion,
    activa = EXCLUDED.activa,
    direccion = EXCLUDED.direccion,
    telefono = EXCLUDED.telefono,
    email = EXCLUDED.email,
    estado = EXCLUDED.estado;

INSERT INTO usuarios (email, password, tipo_usuario, fecha_registro, activo)
VALUES
    ('ciudadano01@gmail.com', 'Saip2026*', 'CIUDADANO', CURRENT_TIMESTAMP, TRUE),
    ('ciudadano02@hotmail.com', 'Saip2026*', 'CIUDADANO', CURRENT_TIMESTAMP, TRUE),
    ('ciudadano03@outlook.com', 'Saip2026*', 'CIUDADANO', CURRENT_TIMESTAMP, TRUE),
    ('ciudadano04@yahoo.com', 'Saip2026*', 'CIUDADANO', CURRENT_TIMESTAMP, TRUE),
    ('ciudadano05@gmail.com', 'Saip2026*', 'CIUDADANO', CURRENT_TIMESTAMP, TRUE),
    ('ciudadano06@hotmail.com', 'Saip2026*', 'CIUDADANO', CURRENT_TIMESTAMP, TRUE),
    ('ciudadano07@outlook.com', 'Saip2026*', 'CIUDADANO', CURRENT_TIMESTAMP, TRUE),
    ('ciudadano08@yahoo.com', 'Saip2026*', 'CIUDADANO', CURRENT_TIMESTAMP, TRUE),
    ('ciudadano09@gmail.com', 'Saip2026*', 'CIUDADANO', CURRENT_TIMESTAMP, TRUE),
    ('ciudadano10@hotmail.com', 'Saip2026*', 'CIUDADANO', CURRENT_TIMESTAMP, TRUE),
    ('tvalverde@minjus.gob.pe', 'Saip2026*', 'TTAIP', CURRENT_TIMESTAMP, TRUE),
    ('lagurto@minjus.gob.pe', 'Saip2026*', 'TTAIP', CURRENT_TIMESTAMP, TRUE),
    ('szamora@minjus.gob.pe', 'Saip2026*', 'TTAIP', CURRENT_TIMESTAMP, TRUE),
    ('jpichon@minjus.gob.pe', 'Saip2026*', 'TTAIP', CURRENT_TIMESTAMP, TRUE),
    ('jmancilla@minjus.gob.pe', 'Saip2026*', 'TTAIP', CURRENT_TIMESTAMP, TRUE),
    ('jrojasb@minjus.gob.pe', 'Saip2026*', 'TTAIP', CURRENT_TIMESTAMP, TRUE),
    ('admin@saip.gob.pe', 'Saip2026*', 'ADMINISTRADOR', CURRENT_TIMESTAMP, TRUE)
ON CONFLICT (email) DO UPDATE SET
    password = EXCLUDED.password,
    tipo_usuario = EXCLUDED.tipo_usuario,
    activo = EXCLUDED.activo;

INSERT INTO ciudadanos (id_usuario, dni, nombre_completo, telefono, direccion)
SELECT u.id_usuario, c.dni, c.nombre_completo, c.telefono, c.direccion
FROM (VALUES
    ('ciudadano01@gmail.com', '70000001', 'Ciudadano Demo 01', '900000001', 'Lima - Peru'),
    ('ciudadano02@hotmail.com', '70000002', 'Ciudadano Demo 02', '900000002', 'Lima - Peru'),
    ('ciudadano03@outlook.com', '70000003', 'Ciudadano Demo 03', '900000003', 'Lima - Peru'),
    ('ciudadano04@yahoo.com', '70000004', 'Ciudadano Demo 04', '900000004', 'Lima - Peru'),
    ('ciudadano05@gmail.com', '70000005', 'Ciudadano Demo 05', '900000005', 'Lima - Peru'),
    ('ciudadano06@hotmail.com', '70000006', 'Ciudadano Demo 06', '900000006', 'Lima - Peru'),
    ('ciudadano07@outlook.com', '70000007', 'Ciudadano Demo 07', '900000007', 'Lima - Peru'),
    ('ciudadano08@yahoo.com', '70000008', 'Ciudadano Demo 08', '900000008', 'Lima - Peru'),
    ('ciudadano09@gmail.com', '70000009', 'Ciudadano Demo 09', '900000009', 'Lima - Peru'),
    ('ciudadano10@hotmail.com', '70000010', 'Ciudadano Demo 10', '900000010', 'Lima - Peru')
) AS c(email, dni, nombre_completo, telefono, direccion)
JOIN usuarios u ON u.email = c.email
ON CONFLICT (id_usuario) DO UPDATE SET
    dni = EXCLUDED.dni,
    nombre_completo = EXCLUDED.nombre_completo,
    telefono = EXCLUDED.telefono,
    direccion = EXCLUDED.direccion;

INSERT INTO miembros_ttaip (id_usuario, nombre_completo, cargo, sala, especialidad, periodo_inicio, periodo_fin, presidente_tribunal)
SELECT u.id_usuario, t.nombre_completo, t.cargo, t.sala, t.especialidad, t.periodo_inicio, t.periodo_fin, t.presidente_tribunal
FROM (VALUES
    ('tvalverde@minjus.gob.pe', 'Tatiana Azucena Valverde Alvarado', 'Presidenta', 'PRIMERA SALA', 'Derecho administrativo', DATE '2025-03-22', DATE '2026-03-21', FALSE),
    ('lagurto@minjus.gob.pe', 'Luis Guillermo Agurto Villegas', 'Vocal', 'PRIMERA SALA', 'Transparencia y acceso a la informacion', DATE '2025-03-22', DATE '2026-03-21', FALSE),
    ('szamora@minjus.gob.pe', 'Segundo Ulises Zamora Barboza', 'Vocal', 'PRIMERA SALA', 'Gestion publica', DATE '2025-03-22', DATE '2026-03-21', FALSE),
    ('jpichon@minjus.gob.pe', 'Junior Pichon De la Cruz', 'Presidente', 'SEGUNDA SALA', 'Procedimiento administrativo', DATE '2025-06-04', DATE '2026-06-03', FALSE),
    ('jmancilla@minjus.gob.pe', 'Julio Cesar Mancilla Crespo', 'Vocal', 'SEGUNDA SALA', 'Derecho constitucional', DATE '2025-06-09', DATE '2026-06-08', TRUE),
    ('jrojasb@minjus.gob.pe', 'Jessica Martha Rojas Barrueta', 'Vocal', 'SEGUNDA SALA', 'Proteccion de datos', DATE '2025-06-04', DATE '2026-06-03', FALSE)
) AS t(email, nombre_completo, cargo, sala, especialidad, periodo_inicio, periodo_fin, presidente_tribunal)
JOIN usuarios u ON u.email = t.email
ON CONFLICT (id_usuario) DO UPDATE SET
    nombre_completo = EXCLUDED.nombre_completo,
    cargo = EXCLUDED.cargo,
    sala = EXCLUDED.sala,
    especialidad = EXCLUDED.especialidad,
    periodo_inicio = EXCLUDED.periodo_inicio,
    periodo_fin = EXCLUDED.periodo_fin,
    presidente_tribunal = EXCLUDED.presidente_tribunal;

UPDATE usuarios u
SET activo = FALSE
FROM miembros_ttaip mt
WHERE mt.id_usuario = u.id_usuario
  AND u.tipo_usuario = 'TTAIP'
  AND u.email NOT IN ('tvalverde@minjus.gob.pe', 'lagurto@minjus.gob.pe', 'szamora@minjus.gob.pe', 'jpichon@minjus.gob.pe', 'jmancilla@minjus.gob.pe', 'jrojasb@minjus.gob.pe');

INSERT INTO salas_ttaip (nombre, periodo_inicio, periodo_fin, id_presidente_sala, activa)
SELECT 'PRIMERA SALA', DATE '2025-03-22', DATE '2026-03-21', u.id_usuario, TRUE
FROM usuarios u
WHERE u.email = 'tvalverde@minjus.gob.pe'
ON CONFLICT (nombre) DO UPDATE SET
    periodo_inicio = EXCLUDED.periodo_inicio,
    periodo_fin = EXCLUDED.periodo_fin,
    id_presidente_sala = EXCLUDED.id_presidente_sala,
    activa = EXCLUDED.activa;

INSERT INTO salas_ttaip (nombre, periodo_inicio, periodo_fin, id_presidente_sala, activa)
SELECT 'SEGUNDA SALA', DATE '2025-06-04', DATE '2026-06-03', u.id_usuario, TRUE
FROM usuarios u
WHERE u.email = 'jpichon@minjus.gob.pe'
ON CONFLICT (nombre) DO UPDATE SET
    periodo_inicio = EXCLUDED.periodo_inicio,
    periodo_fin = EXCLUDED.periodo_fin,
    id_presidente_sala = EXCLUDED.id_presidente_sala,
    activa = EXCLUDED.activa;

INSERT INTO administradores (id_usuario, nombre_completo, rol, permisos)
SELECT u.id_usuario, 'Administrador General SAIP', 'SUPER_ADMIN', 'USUARIOS,ENTIDADES,REPORTES,CONFIGURACION'
FROM usuarios u
WHERE u.email = 'admin@saip.gob.pe'
ON CONFLICT (id_usuario) DO UPDATE SET
    nombre_completo = EXCLUDED.nombre_completo,
    rol = EXCLUDED.rol,
    permisos = EXCLUDED.permisos;

INSERT INTO usuarios (email, password, tipo_usuario, fecha_registro, activo)
SELECT 'func.' || lower(e.acronimo) || '@' || lower(e.acronimo) || '.gob.pe',
       'Saip2026*',
       'FUNCIONARIO',
       CURRENT_TIMESTAMP,
       TRUE
FROM entidades e
WHERE e.acronimo IN ('MINEDU', 'MINSA', 'MININTER', 'MINJUSDH', 'MEF', 'MTC', 'MIDIS', 'MINAM', 'SUNAT', 'OSIPTEL')
ON CONFLICT (email) DO UPDATE SET
    password = EXCLUDED.password,
    tipo_usuario = EXCLUDED.tipo_usuario,
    activo = EXCLUDED.activo;

INSERT INTO funcionarios (id_usuario, nombre_completo, cargo, area, telefono, id_entidad)
SELECT u.id_usuario,
       'Funcionario ' || e.acronimo || ' Principal',
       'Especialista de Acceso a la Informacion',
       'Oficina de Acceso a la Informacion',
       '9' || lpad(e.id_entidad::text, 8, '0'),
       e.id_entidad
FROM entidades e
JOIN usuarios u ON u.email = 'func.' || lower(e.acronimo) || '@' || lower(e.acronimo) || '.gob.pe'
WHERE e.acronimo IN ('MINEDU', 'MINSA', 'MININTER', 'MINJUSDH', 'MEF', 'MTC', 'MIDIS', 'MINAM', 'SUNAT', 'OSIPTEL')
ON CONFLICT (id_usuario) DO UPDATE SET
    nombre_completo = EXCLUDED.nombre_completo,
    cargo = EXCLUDED.cargo,
    area = EXCLUDED.area,
    telefono = EXCLUDED.telefono,
    id_entidad = EXCLUDED.id_entidad;

INSERT INTO solicitudes (
    expediente, asunto, descripcion, id_ciudadano, id_entidad, fecha_presentacion, fecha_limite, estado,
    prioridad, formato_digital, formato_fisico, copia_simple, copia_certificada, tipo_informacion,
    consentimiento_datos_personales, canal_notificacion
)
SELECT s.expediente, s.asunto, s.descripcion, c.id_usuario, e.id_entidad, s.fecha_presentacion, s.fecha_limite,
       s.estado, s.prioridad, s.formato_digital, s.formato_fisico, s.copia_simple, s.copia_certificada,
       s.tipo_informacion, TRUE, s.canal_notificacion
FROM (VALUES
    ('SAIP-2026-10001', 'Solicitud de informacion sobre presupuesto institucional', 'Solicito el detalle del presupuesto institucional y su ejecucion del ultimo periodo.', 'ciudadano01@gmail.com', 'MINEDU', CURRENT_TIMESTAMP - INTERVAL '6 days', (CURRENT_DATE + INTERVAL '4 days')::date, 'RECEPCIONADA', 'MEDIA', TRUE, FALSE, TRUE, FALSE, 'Informacion presupuestal', 'CASILLA_ELECTRONICA'),
    ('SAIP-2026-10002', 'Solicitud de contratos de adquisicion', 'Solicito informacion sobre contratos de adquisicion del ultimo trimestre.', 'ciudadano02@hotmail.com', 'MINSA', CURRENT_TIMESTAMP - INTERVAL '8 days', (CURRENT_DATE + INTERVAL '2 days')::date, 'EN_REVISION', 'ALTA', TRUE, TRUE, TRUE, FALSE, 'Contrataciones del Estado', 'CORREO_ELECTRONICO'),
    ('SAIP-2026-10003', 'Solicitud de ejecucion de obras publicas', 'Solicito reportes de avance y ejecucion de obras publicas del periodo anual.', 'ciudadano03@outlook.com', 'MININTER', CURRENT_TIMESTAMP - INTERVAL '15 days', (CURRENT_DATE - INTERVAL '2 days')::date, 'RESPONDIDA', 'MEDIA', TRUE, FALSE, TRUE, FALSE, 'Obras publicas', 'CASILLA_ELECTRONICA'),
    ('SAIP-2026-10004', 'Solicitud de informes disciplinarios', 'Solicito informes disciplinarios emitidos durante el ultimo semestre.', 'ciudadano04@yahoo.com', 'MINJUSDH', CURRENT_TIMESTAMP - INTERVAL '13 days', (CURRENT_DATE - INTERVAL '1 day')::date, 'DENEGADA', 'ALTA', TRUE, FALSE, TRUE, TRUE, 'Informes disciplinarios', 'CASILLA_ELECTRONICA'),
    ('SAIP-2026-10005', 'Solicitud de actas de comite tecnico', 'Solicito actas y acuerdos del comite tecnico del ultimo bimestre.', 'ciudadano05@gmail.com', 'MEF', CURRENT_TIMESTAMP - INTERVAL '20 days', (CURRENT_DATE - INTERVAL '5 days')::date, 'CONCLUIDA', 'NORMAL', TRUE, TRUE, TRUE, FALSE, 'Actas institucionales', 'FISICA')
) AS s(expediente, asunto, descripcion, ciudadano_email, entidad_acronimo, fecha_presentacion, fecha_limite, estado, prioridad, formato_digital, formato_fisico, copia_simple, copia_certificada, tipo_informacion, canal_notificacion)
JOIN usuarios u ON u.email = s.ciudadano_email
JOIN ciudadanos c ON c.id_usuario = u.id_usuario
JOIN entidades e ON e.acronimo = s.entidad_acronimo
ON CONFLICT (expediente) DO UPDATE SET
    asunto = EXCLUDED.asunto,
    descripcion = EXCLUDED.descripcion,
    id_ciudadano = EXCLUDED.id_ciudadano,
    id_entidad = EXCLUDED.id_entidad,
    fecha_limite = EXCLUDED.fecha_limite,
    estado = EXCLUDED.estado,
    prioridad = EXCLUDED.prioridad,
    consentimiento_datos_personales = EXCLUDED.consentimiento_datos_personales,
    canal_notificacion = EXCLUDED.canal_notificacion;

INSERT INTO respuestas (id_solicitud, id_funcionario, tipo_respuesta, contenido, causal_denegatoria, fundamento_legal, fecha_respuesta, decision)
SELECT s.id_solicitud, f.id_usuario, r.tipo_respuesta, r.contenido, r.causal_denegatoria, r.fundamento_legal, r.fecha_respuesta, r.decision
FROM (VALUES
    ('SAIP-2026-10003', 'func.mininter@mininter.gob.pe', 'ENTREGA_TOTAL', 'Se entrega la informacion solicitada en formato digital, con detalle de obras y avances.', NULL::varchar, NULL::text, CURRENT_TIMESTAMP - INTERVAL '3 days', 'aceptar'),
    ('SAIP-2026-10004', 'func.minjusdh@minjusdh.gob.pe', 'DENEGACION_TOTAL', 'No es posible atender la solicitud por tratarse de informacion clasificada.', 'Informacion vinculada a investigaciones en tramite', 'Articulo 15-B de la Ley 27806', CURRENT_TIMESTAMP - INTERVAL '2 days', 'denegar')
) AS r(expediente, funcionario_email, tipo_respuesta, contenido, causal_denegatoria, fundamento_legal, fecha_respuesta, decision)
JOIN solicitudes s ON s.expediente = r.expediente
JOIN usuarios uf ON uf.email = r.funcionario_email
JOIN funcionarios f ON f.id_usuario = uf.id_usuario
ON CONFLICT (id_solicitud) DO UPDATE SET
    id_funcionario = EXCLUDED.id_funcionario,
    tipo_respuesta = EXCLUDED.tipo_respuesta,
    contenido = EXCLUDED.contenido,
    causal_denegatoria = EXCLUDED.causal_denegatoria,
    fundamento_legal = EXCLUDED.fundamento_legal,
    fecha_respuesta = EXCLUDED.fecha_respuesta,
    decision = EXCLUDED.decision;

INSERT INTO apelaciones (expediente, fundamentos, estado, resultado, calificacion_primera, calificacion_segunda, id_solicitud, id_ciudadano, fecha_apelacion, fecha_subsanacion, dias_subsanacion, tipo_origen, id_entidad_apelada)
SELECT a.expediente, a.fundamentos, a.estado, a.resultado, a.calificacion_primera, a.calificacion_segunda,
       s.id_solicitud, s.id_ciudadano, a.fecha_apelacion, a.fecha_subsanacion, a.dias_subsanacion,
       'SAIP_INTERNA', s.id_entidad
FROM (VALUES
    ('01560-2025-JUS/TTAIP', 'SAIP-2026-10004', 'Apelo la denegatoria por considerar que la informacion es de interes publico y no se acredito excepcion legal suficiente.', 'EN_RESOLUCION', NULL::varchar, 'ADMISIBLE', NULL::varchar, CURRENT_TIMESTAMP - INTERVAL '1 day', NULL::date, NULL::integer),
    ('01561-2025-JUS/TTAIP', 'SAIP-2026-10005', 'Se presentan fundamentos adicionales para subsanar las observaciones notificadas por el Tribunal.', 'EN_CALIFICACION_2', NULL::varchar, 'INADMISIBLE', NULL::varchar, CURRENT_TIMESTAMP - INTERVAL '4 days', CURRENT_DATE, 2),
    ('01562-2025-JUS/TTAIP', 'SAIP-2026-10003', 'Apelo la respuesta emitida y adjunto subsanacion para que el Tribunal emita pronunciamiento de fondo.', 'RESUELTO_FUNDADO_EN_PARTE', 'FUNDADO_EN_PARTE', 'INADMISIBLE', 'ADMITIDO', CURRENT_TIMESTAMP - INTERVAL '18 days', (CURRENT_DATE - INTERVAL '12 days')::date, 2)
) AS a(expediente, solicitud_expediente, fundamentos, estado, resultado, calificacion_primera, calificacion_segunda, fecha_apelacion, fecha_subsanacion, dias_subsanacion)
JOIN solicitudes s ON s.expediente = a.solicitud_expediente
ON CONFLICT (expediente) DO UPDATE SET
    fundamentos = EXCLUDED.fundamentos,
    estado = EXCLUDED.estado,
    resultado = EXCLUDED.resultado,
    calificacion_primera = EXCLUDED.calificacion_primera,
    calificacion_segunda = EXCLUDED.calificacion_segunda,
    id_solicitud = EXCLUDED.id_solicitud,
    id_ciudadano = EXCLUDED.id_ciudadano,
    fecha_subsanacion = EXCLUDED.fecha_subsanacion,
    dias_subsanacion = EXCLUDED.dias_subsanacion,
    tipo_origen = EXCLUDED.tipo_origen,
    id_entidad_apelada = EXCLUDED.id_entidad_apelada;

INSERT INTO expedientes_ttaip (
    numero_expediente, id_apelacion, id_sala_ttaip, estado, fecha_apertura, fecha_actualizacion,
    fecha_primera_calificacion, fecha_segunda_calificacion, fecha_resolucion_final, fecha_limite_resolucion,
    trazabilidad_minima
)
SELECT a.expediente,
       a.id_apelacion,
       st.id_sala_ttaip,
       a.estado,
       a.fecha_apelacion,
       CURRENT_TIMESTAMP,
       CASE WHEN a.expediente IN ('01560-2025-JUS/TTAIP', '01561-2025-JUS/TTAIP', '01562-2025-JUS/TTAIP') THEN a.fecha_apelacion + INTERVAL '2 days' ELSE NULL END,
       CASE WHEN a.expediente = '01562-2025-JUS/TTAIP' THEN a.fecha_apelacion + INTERVAL '7 days' ELSE NULL END,
       CASE WHEN a.expediente = '01562-2025-JUS/TTAIP' THEN a.fecha_apelacion + INTERVAL '14 days' ELSE NULL END,
       CASE WHEN a.expediente IN ('01561-2025-JUS/TTAIP', '01562-2025-JUS/TTAIP') THEN (CURRENT_DATE + INTERVAL '10 days')::date ELSE NULL END,
       to_char(CURRENT_TIMESTAMP, 'YYYY-MM-DD HH24:MI:SS') || ' - Expediente TTAIP abierto sin etapa de elevacion; sala asignada: ' || st.nombre
FROM apelaciones a
JOIN (VALUES
    ('01560-2025-JUS/TTAIP', 'PRIMERA SALA'),
    ('01561-2025-JUS/TTAIP', 'SEGUNDA SALA'),
    ('01562-2025-JUS/TTAIP', 'SEGUNDA SALA')
) AS map(expediente, sala) ON map.expediente = a.expediente
JOIN salas_ttaip st ON st.nombre = map.sala
ON CONFLICT (numero_expediente) DO UPDATE SET
    id_apelacion = EXCLUDED.id_apelacion,
    id_sala_ttaip = EXCLUDED.id_sala_ttaip,
    estado = EXCLUDED.estado,
    fecha_actualizacion = EXCLUDED.fecha_actualizacion,
    fecha_primera_calificacion = EXCLUDED.fecha_primera_calificacion,
    fecha_segunda_calificacion = EXCLUDED.fecha_segunda_calificacion,
    fecha_resolucion_final = EXCLUDED.fecha_resolucion_final,
    fecha_limite_resolucion = EXCLUDED.fecha_limite_resolucion,
    trazabilidad_minima = EXCLUDED.trazabilidad_minima;

INSERT INTO expediente_ttaip_miembros (id_expediente_ttaip, id_miembro_ttaip)
SELECT et.id_expediente_ttaip, mt.id_usuario
FROM expedientes_ttaip et
JOIN salas_ttaip st ON st.id_sala_ttaip = et.id_sala_ttaip
JOIN miembros_ttaip mt ON mt.sala = st.nombre
WHERE et.numero_expediente IN ('01560-2025-JUS/TTAIP', '01561-2025-JUS/TTAIP', '01562-2025-JUS/TTAIP')
ON CONFLICT (id_expediente_ttaip, id_miembro_ttaip) DO NOTHING;

INSERT INTO resoluciones (
    id_apelacion, id_expediente_ttaip, id_sala_ttaip, id_miembro_ttaip, tipo_resolucion, decision,
    fundamentos, fundamento_legal, fecha_resolucion, numero_resolucion, observaciones, resultado,
    iniciar_proceso_disciplinario
)
SELECT a.id_apelacion, et.id_expediente_ttaip, st.id_sala_ttaip, mt.id_usuario, r.tipo_resolucion,
       r.decision, r.fundamentos, r.fundamento_legal, r.fecha_resolucion, r.numero_resolucion,
       r.observaciones, r.resultado, r.iniciar_proceso_disciplinario
FROM (VALUES
    ('01560-2025-JUS/TTAIP', 'tvalverde@minjus.gob.pe', 'PRIMERA_CALIFICACION', 'ADMISIBLE', 'La apelacion cumple requisitos formales y pasa a resolucion final.', 'Ley N. 27806 y Reglamento del TTAIP.', CURRENT_TIMESTAMP - INTERVAL '1 day', 'RESOLUCIÓN N.° 001595-2025-JUS/TTAIP-PRIMERA SALA', 'Primera calificacion emitida por la Primera Sala.', NULL::varchar, FALSE),
    ('01561-2025-JUS/TTAIP', 'jpichon@minjus.gob.pe', 'PRIMERA_CALIFICACION', 'INADMISIBLE', 'Se requiere subsanacion del recurso dentro del plazo legal.', 'Reglas de admisibilidad del procedimiento TTAIP.', CURRENT_TIMESTAMP - INTERVAL '3 days', 'RESOLUCIÓN N.° 002010-2025-JUS/TTAIP-SEGUNDA SALA', 'Primera calificacion emitida por la Segunda Sala.', NULL::varchar, FALSE),
    ('01562-2025-JUS/TTAIP', 'jpichon@minjus.gob.pe', 'PRIMERA_CALIFICACION', 'INADMISIBLE', 'El recurso fue observado y se notifico plazo de subsanacion.', 'Reglas de admisibilidad del procedimiento TTAIP.', CURRENT_TIMESTAMP - INTERVAL '16 days', 'RESOLUCIÓN N.° 002100-2025-JUS/TTAIP-SEGUNDA SALA', 'Primera calificacion con observaciones subsanables.', NULL::varchar, FALSE),
    ('01562-2025-JUS/TTAIP', 'jpichon@minjus.gob.pe', 'SEGUNDA_CALIFICACION', 'ADMITIDO', 'La subsanacion presentada cumple las observaciones formuladas.', 'Reglas de admisibilidad del procedimiento TTAIP.', CURRENT_TIMESTAMP - INTERVAL '11 days', 'RESOLUCIÓN N.° 002101-2025-JUS/TTAIP-SEGUNDA SALA', 'Segunda calificacion emitida y notificada antes del plazo de resolucion final.', NULL::varchar, FALSE),
    ('01562-2025-JUS/TTAIP', 'jmancilla@minjus.gob.pe', 'RESOLUCION_FINAL', 'FUNDADO_EN_PARTE', 'El Tribunal declara fundado en parte el recurso y ordena entregar la informacion publica no exceptuada.', 'Ley N. 27806, jurisprudencia administrativa y Reglamento del TTAIP.', CURRENT_TIMESTAMP - INTERVAL '4 days', 'RESOLUCIÓN N.° 002102-2025-JUS/TTAIP-SEGUNDA SALA', 'Resolucion final emitida por la Segunda Sala.', 'FUNDADO_EN_PARTE', TRUE)
) AS r(expediente, email_miembro, tipo_resolucion, decision, fundamentos, fundamento_legal, fecha_resolucion, numero_resolucion, observaciones, resultado, iniciar_proceso_disciplinario)
JOIN apelaciones a ON a.expediente = r.expediente
JOIN expedientes_ttaip et ON et.numero_expediente = a.expediente
JOIN salas_ttaip st ON st.id_sala_ttaip = et.id_sala_ttaip
JOIN usuarios u ON u.email = r.email_miembro
JOIN miembros_ttaip mt ON mt.id_usuario = u.id_usuario
ON CONFLICT (numero_resolucion) DO UPDATE SET
    id_apelacion = EXCLUDED.id_apelacion,
    id_expediente_ttaip = EXCLUDED.id_expediente_ttaip,
    id_sala_ttaip = EXCLUDED.id_sala_ttaip,
    id_miembro_ttaip = EXCLUDED.id_miembro_ttaip,
    tipo_resolucion = EXCLUDED.tipo_resolucion,
    decision = EXCLUDED.decision,
    fundamentos = EXCLUDED.fundamentos,
    fundamento_legal = EXCLUDED.fundamento_legal,
    fecha_resolucion = EXCLUDED.fecha_resolucion,
    observaciones = EXCLUDED.observaciones,
    resultado = EXCLUDED.resultado,
    iniciar_proceso_disciplinario = EXCLUDED.iniciar_proceso_disciplinario;

INSERT INTO cedulas_notificacion (id_resolucion, numero_cedula, destinatario, destinatario_nombre, destinatario_email, fecha_emision, canal, estado, documento_referencia)
SELECT r.id_resolucion,
       c.numero_cedula,
       c.destinatario,
       CASE WHEN c.destinatario = 'CIUDADANO' THEN ci.nombre_completo ELSE e.nombre END,
       CASE WHEN c.destinatario = 'CIUDADANO' THEN uci.email ELSE e.email END,
       c.fecha_emision,
       'CASILLA_ELECTRONICA',
       'EMITIDA',
       'CÉDULA DE NOTIFICACIÓN N.° ' || c.numero_cedula
FROM (VALUES
    ('RESOLUCIÓN N.° 001595-2025-JUS/TTAIP-PRIMERA SALA', '15203-2025-JUS/TTAIP', 'CIUDADANO', CURRENT_TIMESTAMP - INTERVAL '1 day'),
    ('RESOLUCIÓN N.° 001595-2025-JUS/TTAIP-PRIMERA SALA', '15203-2025-JUS/TTAIP', 'ENTIDAD_PUBLICA', CURRENT_TIMESTAMP - INTERVAL '1 day'),
    ('RESOLUCIÓN N.° 002010-2025-JUS/TTAIP-SEGUNDA SALA', '15204-2025-JUS/TTAIP', 'CIUDADANO', CURRENT_TIMESTAMP - INTERVAL '3 days'),
    ('RESOLUCIÓN N.° 002100-2025-JUS/TTAIP-SEGUNDA SALA', '15205-2025-JUS/TTAIP', 'CIUDADANO', CURRENT_TIMESTAMP - INTERVAL '16 days'),
    ('RESOLUCIÓN N.° 002101-2025-JUS/TTAIP-SEGUNDA SALA', '15206-2025-JUS/TTAIP', 'CIUDADANO', CURRENT_TIMESTAMP - INTERVAL '11 days'),
    ('RESOLUCIÓN N.° 002101-2025-JUS/TTAIP-SEGUNDA SALA', '15206-2025-JUS/TTAIP', 'ENTIDAD_PUBLICA', CURRENT_TIMESTAMP - INTERVAL '11 days'),
    ('RESOLUCIÓN N.° 002102-2025-JUS/TTAIP-SEGUNDA SALA', '15207-2025-JUS/TTAIP', 'CIUDADANO', CURRENT_TIMESTAMP - INTERVAL '4 days'),
    ('RESOLUCIÓN N.° 002102-2025-JUS/TTAIP-SEGUNDA SALA', '15207-2025-JUS/TTAIP', 'ENTIDAD_PUBLICA', CURRENT_TIMESTAMP - INTERVAL '4 days'),
    ('RESOLUCIÓN N.° 002102-2025-JUS/TTAIP-SEGUNDA SALA', '15208-2025-JUS/TTAIP', 'ENTIDAD_PUBLICA', CURRENT_TIMESTAMP - INTERVAL '2 days')
) AS c(numero_resolucion, numero_cedula, destinatario, fecha_emision)
JOIN resoluciones r ON r.numero_resolucion = c.numero_resolucion
JOIN apelaciones a ON a.id_apelacion = r.id_apelacion
JOIN ciudadanos ci ON ci.id_usuario = a.id_ciudadano
JOIN usuarios uci ON uci.id_usuario = ci.id_usuario
JOIN solicitudes s ON s.id_solicitud = a.id_solicitud
JOIN entidades e ON e.id_entidad = s.id_entidad
ON CONFLICT (numero_cedula, destinatario) DO UPDATE SET
    id_resolucion = EXCLUDED.id_resolucion,
    destinatario_nombre = EXCLUDED.destinatario_nombre,
    destinatario_email = EXCLUDED.destinatario_email,
    fecha_emision = EXCLUDED.fecha_emision,
    canal = EXCLUDED.canal,
    estado = EXCLUDED.estado,
    documento_referencia = EXCLUDED.documento_referencia;

INSERT INTO notificaciones_ttaip (
    id_expediente_ttaip, id_cedula, destinatario, destinatario_nombre, destinatario_email, fecha_notificacion,
    medio, estado, detalle, medio_notificacion, fecha_envio, codigo_envio, codigo_constancia,
    constancia_envio, estado_acuse, resultado_notificacion, validada_manualmente, responsable_constancia,
    trazabilidad
)
SELECT et.id_expediente_ttaip,
       cn.id_cedula,
       cn.destinatario,
       cn.destinatario_nombre,
       cn.destinatario_email,
       cn.fecha_emision,
       'CASILLA_ELECTRONICA',
       'ENVIADA',
       'Notificacion oficial de ' || r.numero_resolucion || ' para ' || cn.destinatario,
       'CASILLA_ELECTRONICA',
       cn.fecha_emision,
       'ENV-' || cn.numero_cedula || '-' || cn.destinatario,
       'CONST-' || cn.numero_cedula || '-' || cn.destinatario,
       'Constancia de envio semilla para ' || cn.numero_cedula || ' - ' || cn.destinatario,
       'PENDIENTE',
       'ENVIADA',
       FALSE,
       'Seed TTAIP',
       CURRENT_TIMESTAMP::text || ' - Constancia de envio semilla registrada para ' || cn.numero_cedula || ' - ' || cn.destinatario
FROM cedulas_notificacion cn
JOIN resoluciones r ON r.id_resolucion = cn.id_resolucion
JOIN expedientes_ttaip et ON et.id_expediente_ttaip = r.id_expediente_ttaip
WHERE r.numero_resolucion IN (
    'RESOLUCIÓN N.° 001595-2025-JUS/TTAIP-PRIMERA SALA',
    'RESOLUCIÓN N.° 002010-2025-JUS/TTAIP-SEGUNDA SALA',
    'RESOLUCIÓN N.° 002100-2025-JUS/TTAIP-SEGUNDA SALA',
    'RESOLUCIÓN N.° 002101-2025-JUS/TTAIP-SEGUNDA SALA',
    'RESOLUCIÓN N.° 002102-2025-JUS/TTAIP-SEGUNDA SALA'
)
ON CONFLICT (id_cedula) DO UPDATE SET
    id_expediente_ttaip = EXCLUDED.id_expediente_ttaip,
    destinatario = EXCLUDED.destinatario,
    destinatario_nombre = EXCLUDED.destinatario_nombre,
    destinatario_email = EXCLUDED.destinatario_email,
    fecha_notificacion = EXCLUDED.fecha_notificacion,
    medio = EXCLUDED.medio,
    estado = EXCLUDED.estado,
    detalle = EXCLUDED.detalle,
    medio_notificacion = EXCLUDED.medio_notificacion,
    fecha_envio = EXCLUDED.fecha_envio,
    codigo_envio = EXCLUDED.codigo_envio,
    codigo_constancia = EXCLUDED.codigo_constancia,
    constancia_envio = EXCLUDED.constancia_envio,
    estado_acuse = EXCLUDED.estado_acuse,
    resultado_notificacion = EXCLUDED.resultado_notificacion,
    validada_manualmente = EXCLUDED.validada_manualmente,
    responsable_constancia = EXCLUDED.responsable_constancia,
    trazabilidad = EXCLUDED.trazabilidad;

UPDATE notificaciones_ttaip n
SET estado = 'FALLIDA',
    estado_acuse = 'FALLIDO',
    resultado_notificacion = 'REPROCESO_REQUERIDO',
    acuse_automatico = 'Acuse semilla fallido para validar reproceso.',
    detalle = 'Notificacion original observada; se genero reproceso para la entidad publica.',
    trazabilidad = COALESCE(n.trazabilidad, '') || E'\n' || CURRENT_TIMESTAMP::text || ' - Acuse fallido semilla; corresponde reproceso.'
FROM cedulas_notificacion cn
WHERE cn.id_cedula = n.id_cedula
  AND cn.numero_cedula = '15207-2025-JUS/TTAIP'
  AND cn.destinatario = 'ENTIDAD_PUBLICA';

UPDATE notificaciones_ttaip n
SET estado = 'PENDIENTE',
    estado_acuse = 'PENDIENTE',
    resultado_notificacion = 'PENDIENTE_CONSTANCIA_REPROCESO',
    detalle = 'Nueva notificacion generada por reproceso de cedula observada.',
    trazabilidad = COALESCE(n.trazabilidad, '') || E'\n' || CURRENT_TIMESTAMP::text || ' - Notificacion semilla generada por reproceso.'
FROM cedulas_notificacion cn
WHERE cn.id_cedula = n.id_cedula
  AND cn.numero_cedula = '15208-2025-JUS/TTAIP'
  AND cn.destinatario = 'ENTIDAD_PUBLICA';

INSERT INTO historial_ttaip (id_expediente_ttaip, tipo_evento, descripcion, estado_anterior, estado_nuevo, actor, referencia, fecha_evento)
SELECT et.id_expediente_ttaip,
       'APERTURA_EXPEDIENTE',
       'Expediente TTAIP abierto sin etapa de elevacion; sala asignada: ' || st.nombre,
       NULL,
       et.estado,
       'SISTEMA',
       et.numero_expediente,
       COALESCE(et.fecha_apertura, CURRENT_TIMESTAMP)
FROM expedientes_ttaip et
JOIN salas_ttaip st ON st.id_sala_ttaip = et.id_sala_ttaip
WHERE NOT EXISTS (
    SELECT 1 FROM historial_ttaip h
    WHERE h.id_expediente_ttaip = et.id_expediente_ttaip
      AND h.tipo_evento = 'APERTURA_EXPEDIENTE'
      AND h.referencia = et.numero_expediente
);

INSERT INTO historial_ttaip (id_expediente_ttaip, tipo_evento, descripcion, estado_anterior, estado_nuevo, actor, referencia, fecha_evento)
SELECT et.id_expediente_ttaip,
       'RESOLUCION_EMITIDA',
       r.tipo_resolucion || ' registrada por ' || st.nombre,
       NULL,
       et.estado,
       'TTAIP',
       r.numero_resolucion,
       COALESCE(r.fecha_resolucion, CURRENT_TIMESTAMP)
FROM resoluciones r
JOIN expedientes_ttaip et ON et.id_expediente_ttaip = r.id_expediente_ttaip
JOIN salas_ttaip st ON st.id_sala_ttaip = et.id_sala_ttaip
WHERE r.numero_resolucion IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM historial_ttaip h
      WHERE h.id_expediente_ttaip = et.id_expediente_ttaip
        AND h.tipo_evento = 'RESOLUCION_EMITIDA'
        AND h.referencia = r.numero_resolucion
  );

INSERT INTO historial_ttaip (id_expediente_ttaip, tipo_evento, descripcion, estado_anterior, estado_nuevo, actor, referencia, fecha_evento)
SELECT et.id_expediente_ttaip,
       'CEDULA_EMITIDA',
       'Cedula emitida para ' || CASE WHEN cn.destinatario = 'CIUDADANO' THEN 'ciudadano' ELSE 'entidad publica' END || ' por ' || r.numero_resolucion,
       NULL,
       et.estado,
       'TTAIP',
       cn.numero_cedula || ':' || cn.destinatario,
       COALESCE(cn.fecha_emision, CURRENT_TIMESTAMP)
FROM cedulas_notificacion cn
JOIN resoluciones r ON r.id_resolucion = cn.id_resolucion
JOIN expedientes_ttaip et ON et.id_expediente_ttaip = r.id_expediente_ttaip
WHERE NOT EXISTS (
    SELECT 1 FROM historial_ttaip h
    WHERE h.id_expediente_ttaip = et.id_expediente_ttaip
      AND h.tipo_evento = 'CEDULA_EMITIDA'
      AND h.referencia = cn.numero_cedula || ':' || cn.destinatario
);

INSERT INTO historial_ttaip (id_expediente_ttaip, tipo_evento, descripcion, estado_anterior, estado_nuevo, actor, referencia, fecha_evento)
SELECT n.id_expediente_ttaip,
       'NOTIFICACION_REGISTRADA',
       'Notificacion registrada para ' || CASE WHEN n.destinatario = 'CIUDADANO' THEN 'ciudadano' ELSE 'entidad publica' END,
       NULL,
       et.estado,
       'TTAIP',
       'NOTIFICACION-' || cn.numero_cedula || ':' || n.destinatario,
       COALESCE(n.fecha_notificacion, CURRENT_TIMESTAMP)
FROM notificaciones_ttaip n
JOIN expedientes_ttaip et ON et.id_expediente_ttaip = n.id_expediente_ttaip
JOIN cedulas_notificacion cn ON cn.id_cedula = n.id_cedula
WHERE NOT EXISTS (
    SELECT 1 FROM historial_ttaip h
    WHERE h.id_expediente_ttaip = n.id_expediente_ttaip
      AND h.tipo_evento = 'NOTIFICACION_REGISTRADA'
      AND h.referencia = 'NOTIFICACION-' || cn.numero_cedula || ':' || n.destinatario
);

INSERT INTO reprocesos_notificacion (
    id_expediente_ttaip, id_notificacion, id_cedula_original, id_cedula_nueva, id_notificacion_nueva,
    destinatario, numero_cedula_original, fecha_ingreso_cargo, observacion_reproceso, fecha_subsanacion,
    cedula_subsanacion, fecha_cedula_subsanacion, numero_intento, estado, responsable_notificacion,
    responsable_subsanacion, fecha_creacion, fecha_actualizacion
)
SELECT et.id_expediente_ttaip,
       n.id_notificacion,
       cn.id_cedula,
       cn_new.id_cedula,
       n_new.id_notificacion,
       cn.destinatario,
       cn.numero_cedula,
       COALESCE(n.fecha_notificacion, cn.fecha_emision)::date,
       'Cargo de notificacion observado; se genera nueva cedula para el mismo destinatario sin borrar la original.',
       CURRENT_DATE,
       cn_new.numero_cedula,
       CURRENT_DATE,
       1,
       'ATENDIDO',
       'Mesa de Partes TTAIP',
       'Mesa de Partes TTAIP',
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP
FROM cedulas_notificacion cn
JOIN resoluciones r ON r.id_resolucion = cn.id_resolucion
JOIN expedientes_ttaip et ON et.id_expediente_ttaip = r.id_expediente_ttaip
LEFT JOIN notificaciones_ttaip n ON n.id_cedula = cn.id_cedula
JOIN cedulas_notificacion cn_new
    ON cn_new.id_resolucion = cn.id_resolucion
   AND cn_new.numero_cedula = '15208-2025-JUS/TTAIP'
   AND cn_new.destinatario = cn.destinatario
LEFT JOIN notificaciones_ttaip n_new ON n_new.id_cedula = cn_new.id_cedula
WHERE cn.numero_cedula = '15207-2025-JUS/TTAIP'
  AND cn.destinatario = 'ENTIDAD_PUBLICA'
ON CONFLICT (id_cedula_original, destinatario, numero_intento) DO UPDATE SET
    id_expediente_ttaip = EXCLUDED.id_expediente_ttaip,
    id_notificacion = EXCLUDED.id_notificacion,
    id_cedula_nueva = EXCLUDED.id_cedula_nueva,
    id_notificacion_nueva = EXCLUDED.id_notificacion_nueva,
    estado = EXCLUDED.estado,
    fecha_actualizacion = EXCLUDED.fecha_actualizacion;

INSERT INTO historial_ttaip (id_expediente_ttaip, tipo_evento, descripcion, estado_anterior, estado_nuevo, actor, referencia, fecha_evento)
SELECT rp.id_expediente_ttaip,
       'REPROCESO_REGISTRADO',
       'Reproceso de notificacion registrado para ' || CASE WHEN rp.destinatario = 'CIUDADANO' THEN 'ciudadano' ELSE 'entidad publica' END,
       NULL,
       et.estado,
       COALESCE(rp.responsable_notificacion, 'TTAIP'),
       'REPROCESO-' || rp.numero_cedula_original || ':' || rp.destinatario || ':' || rp.numero_intento,
       COALESCE(rp.fecha_creacion, CURRENT_TIMESTAMP)
FROM reprocesos_notificacion rp
JOIN expedientes_ttaip et ON et.id_expediente_ttaip = rp.id_expediente_ttaip
WHERE NOT EXISTS (
    SELECT 1 FROM historial_ttaip h
    WHERE h.id_expediente_ttaip = rp.id_expediente_ttaip
      AND h.tipo_evento = 'REPROCESO_REGISTRADO'
      AND h.referencia = 'REPROCESO-' || rp.numero_cedula_original || ':' || rp.destinatario || ':' || rp.numero_intento
);



-- Quick verification counts.
SELECT 'entidades' AS tabla, COUNT(*) AS total FROM entidades
UNION ALL SELECT 'usuarios', COUNT(*) FROM usuarios
UNION ALL SELECT 'ciudadanos', COUNT(*) FROM ciudadanos
UNION ALL SELECT 'funcionarios', COUNT(*) FROM funcionarios
UNION ALL SELECT 'miembros_ttaip', COUNT(*) FROM miembros_ttaip
UNION ALL SELECT 'administradores', COUNT(*) FROM administradores
UNION ALL SELECT 'salas_ttaip', COUNT(*) FROM salas_ttaip
UNION ALL SELECT 'solicitudes', COUNT(*) FROM solicitudes
UNION ALL SELECT 'apelaciones', COUNT(*) FROM apelaciones
UNION ALL SELECT 'expedientes_ttaip', COUNT(*) FROM expedientes_ttaip
UNION ALL SELECT 'resoluciones', COUNT(*) FROM resoluciones
UNION ALL SELECT 'cedulas_notificacion', COUNT(*) FROM cedulas_notificacion
UNION ALL SELECT 'notificaciones_ttaip', COUNT(*) FROM notificaciones_ttaip
UNION ALL SELECT 'cumplimientos_resolucion_ttaip', COUNT(*) FROM cumplimientos_resolucion_ttaip
UNION ALL SELECT 'historial_ttaip', COUNT(*) FROM historial_ttaip
UNION ALL SELECT 'reprocesos_notificacion', COUNT(*) FROM reprocesos_notificacion
UNION ALL SELECT 'intentos_notificacion', COUNT(*) FROM intentos_notificacion
UNION ALL SELECT 'dispositivos_notificacion_push', COUNT(*) FROM dispositivos_notificacion_push;
