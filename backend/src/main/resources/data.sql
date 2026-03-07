-- ============================================
-- Datos iniciales (seed) para desarrollo — Plataforma SAIP
-- Se ejecuta automáticamente al iniciar Spring Boot (spring.sql.init.mode=always)
-- Usa INSERT IGNORE: solo inserta si el registro no existe (datos persisten entre reinicios)
-- Password: 123456 (plaintext, se migra a BCrypt en primer login vía AuthRestController)
--
-- Orden de inserción respeta dependencias FK:
--   entidades → usuarios/subtipos → solicitudes → respuestas → apelaciones → resoluciones → documentos
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

-- --- Miembros TTAIP — Primera Sala (3 vocales) ---

INSERT IGNORE INTO usuarios (id_usuario, email, password, tipo_usuario, activo, fecha_registro)
VALUES (7, 'tatiana.valverde@ttaip.test', '123456', 'TTAIP', TRUE, NOW());
INSERT IGNORE INTO miembros_ttaip (id_usuario, nombre_completo, cargo, sala, especialidad)
VALUES (7, 'Tatiana Azucena Valverde Alvarado', 'Presidenta de Sala', 'PRIMERA SALA', 'Derecho Administrativo y Gestión Pública');

INSERT IGNORE INTO usuarios (id_usuario, email, password, tipo_usuario, activo, fecha_registro)
VALUES (8, 'luis.agurto@ttaip.test', '123456', 'TTAIP', TRUE, NOW());
INSERT IGNORE INTO miembros_ttaip (id_usuario, nombre_completo, cargo, sala, especialidad)
VALUES (8, 'Luis Guillermo Agurto Villegas', 'Vocal', 'PRIMERA SALA', 'Derecho Constitucional');

INSERT IGNORE INTO usuarios (id_usuario, email, password, tipo_usuario, activo, fecha_registro)
VALUES (9, 'segundo.zamora@ttaip.test', '123456', 'TTAIP', TRUE, NOW());
INSERT IGNORE INTO miembros_ttaip (id_usuario, nombre_completo, cargo, sala, especialidad)
VALUES (9, 'Segundo Ulises Zamora Barboza', 'Vocal', 'PRIMERA SALA', 'Derecho a la Información y Transparencia');

-- --- Miembros TTAIP — Segunda Sala (3 vocales) ---

INSERT IGNORE INTO usuarios (id_usuario, email, password, tipo_usuario, activo, fecha_registro)
VALUES (10, 'junior.pichon@ttaip.test', '123456', 'TTAIP', TRUE, NOW());
INSERT IGNORE INTO miembros_ttaip (id_usuario, nombre_completo, cargo, sala, especialidad)
VALUES (10, 'Junior Pichón De la Cruz', 'Presidente de Sala', 'SEGUNDA SALA', 'Derecho Administrativo');

INSERT IGNORE INTO usuarios (id_usuario, email, password, tipo_usuario, activo, fecha_registro)
VALUES (11, 'julio.mancilla@ttaip.test', '123456', 'TTAIP', TRUE, NOW());
INSERT IGNORE INTO miembros_ttaip (id_usuario, nombre_completo, cargo, sala, especialidad)
VALUES (11, 'Julio César Mancilla Crespo', 'Vocal y Presidente del TTAIP', 'SEGUNDA SALA', 'Derecho Público y Gobernanza');

INSERT IGNORE INTO usuarios (id_usuario, email, password, tipo_usuario, activo, fecha_registro)
VALUES (12, 'jessica.rojas@ttaip.test', '123456', 'TTAIP', TRUE, NOW());
INSERT IGNORE INTO miembros_ttaip (id_usuario, nombre_completo, cargo, sala, especialidad)
VALUES (12, 'Jessica Martha Rojas Barrueta', 'Vocal', 'SEGUNDA SALA', 'Derecho Constitucional y Derechos Humanos');

-- --- Administrador ---

INSERT IGNORE INTO usuarios (id_usuario, email, password, tipo_usuario, activo, fecha_registro)
VALUES (13, 'admin@saip.test', '123456', 'ADMINISTRADOR', TRUE, NOW());
INSERT IGNORE INTO administradores (id_usuario, nombre_completo, rol, permisos)
VALUES (13, 'Administrador del Sistema', 'SUPER_ADMIN', 'TODOS');

-- ============================================
-- 3. SOLICITUDES SAIP (8 solicitudes, todos los estados principales)
-- Formato expediente: SAIP-AAAA-NNNNN
-- BR-SAIP-001: Plazo 10 días hábiles
-- Semáforo: Verde (0-5d), Ámbar (6-8d), Rojo (9-10d), Negro (>10d vencida)
-- ============================================

-- Sol 1: Carlos→ENEDU | RECEPCIONADA | 3 días calendario (~2 hábiles) → Semáforo VERDE
INSERT IGNORE INTO solicitudes (id_solicitud, expediente, asunto, descripcion, id_ciudadano, id_entidad, fecha_presentacion, fecha_limite, estado, prioridad, formato_digital, formato_fisico, copia_simple, copia_certificada, tipo_informacion)
VALUES (1, 'SAIP-2025-00001',
  'Información sobre presupuesto educativo 2024',
  'Solicito información detallada sobre la ejecución del presupuesto del sector educación durante el año fiscal 2024, incluyendo gastos corrientes y de inversión por programa presupuestal.',
  1, 1, DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_ADD(CURDATE(), INTERVAL 11 DAY),
  'RECEPCIONADA', 'MEDIA', TRUE, FALSE, TRUE, FALSE, 'Presupuesto');

-- Sol 2: Carlos→ENSAL | EN_REVISION | 9 días calendario (~7 hábiles) → Semáforo ÁMBAR/ROJO
INSERT IGNORE INTO solicitudes (id_solicitud, expediente, asunto, descripcion, id_ciudadano, id_entidad, fecha_presentacion, fecha_limite, estado, prioridad, formato_digital, formato_fisico, copia_simple, copia_certificada, tipo_informacion)
VALUES (2, 'SAIP-2025-00002',
  'Estadísticas de atención hospitalaria primer trimestre 2025',
  'Solicito datos estadísticos de atención hospitalaria del primer trimestre 2025: número de pacientes atendidos por tipo de atención, tiempos de espera promedio y tasa de ocupación de camas a nivel nacional.',
  1, 2, DATE_SUB(NOW(), INTERVAL 9 DAY), DATE_ADD(CURDATE(), INTERVAL 3 DAY),
  'EN_REVISION', 'ALTA', TRUE, FALSE, TRUE, FALSE, 'Estadísticas de Salud');

-- Sol 3: Carlos→MDC | RESPONDIDA (ENTREGA_TOTAL) | Cerrada dentro de plazo
INSERT IGNORE INTO solicitudes (id_solicitud, expediente, asunto, descripcion, id_ciudadano, id_entidad, fecha_presentacion, fecha_limite, estado, prioridad, formato_digital, formato_fisico, copia_simple, copia_certificada, tipo_informacion)
VALUES (3, 'SAIP-2025-00003',
  'Plan de desarrollo urbano 2025-2030',
  'Solicito copia del Plan de Desarrollo Urbano Metropolitano 2025-2030 aprobado por la Municipalidad Metropolitana de Lima, incluyendo los anexos de zonificación y uso de suelos.',
  1, 3, DATE_SUB(NOW(), INTERVAL 14 DAY), DATE_SUB(CURDATE(), INTERVAL 2 DAY),
  'RESPONDIDA', 'MEDIA', FALSE, TRUE, FALSE, TRUE, 'Planes Institucionales');

-- Sol 4: María→ENSAL | DENEGADA | Respuesta con DENEGACION_TOTAL → apelada (Apelación 1)
INSERT IGNORE INTO solicitudes (id_solicitud, expediente, asunto, descripcion, id_ciudadano, id_entidad, fecha_presentacion, fecha_limite, estado, prioridad, formato_digital, formato_fisico, copia_simple, copia_certificada, tipo_informacion)
VALUES (4, 'SAIP-2025-00004',
  'Contratos de adquisición de medicamentos 2024',
  'Solicito información sobre los contratos de adquisición de medicamentos celebrados por la ENSAL durante el año 2024, incluyendo montos adjudicados, proveedores seleccionados y procesos de selección aplicados.',
  2, 2, DATE_SUB(NOW(), INTERVAL 18 DAY), DATE_SUB(CURDATE(), INTERVAL 6 DAY),
  'DENEGADA', 'ALTA', TRUE, FALSE, TRUE, FALSE, 'Contrataciones');

-- Sol 5: María→ENEDU | RECEPCIONADA | 2 días calendario (~2 hábiles) → Semáforo VERDE
INSERT IGNORE INTO solicitudes (id_solicitud, expediente, asunto, descripcion, id_ciudadano, id_entidad, fecha_presentacion, fecha_limite, estado, prioridad, formato_digital, formato_fisico, copia_simple, copia_certificada, tipo_informacion)
VALUES (5, 'SAIP-2025-00005',
  'Nómina de docentes nombrados UGEL 07',
  'Solicito la nómina actualizada de docentes nombrados en la UGEL 07 durante el proceso de nombramiento docente 2024, incluyendo nivel, especialidad y fecha de nombramiento.',
  2, 1, DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_ADD(CURDATE(), INTERVAL 12 DAY),
  'RECEPCIONADA', 'MEDIA', TRUE, FALSE, TRUE, FALSE, 'Recursos Humanos');

-- Sol 6: Carlos→MDC | VENCIDA | >10 días hábiles sin respuesta → Silencio Administrativo Negativo → apelada (Apelación 2)
-- BR-SAIP-005: Silencio Negativo
INSERT IGNORE INTO solicitudes (id_solicitud, expediente, asunto, descripcion, id_ciudadano, id_entidad, fecha_presentacion, fecha_limite, estado, prioridad, formato_digital, formato_fisico, copia_simple, copia_certificada, tipo_informacion)
VALUES (6, 'SAIP-2025-00006',
  'Expedientes técnicos de obras viales 2024',
  'Solicito acceso a los expedientes técnicos de las obras viales ejecutadas en el Cercado de Lima durante el año 2024, incluyendo presupuestos, cronogramas y actas de recepción.',
  1, 3, DATE_SUB(NOW(), INTERVAL 22 DAY), DATE_SUB(CURDATE(), INTERVAL 8 DAY),
  'VENCIDA', 'URGENTE', TRUE, FALSE, TRUE, FALSE, 'Obras Públicas');

-- Sol 7: María→EJDF | RESPONDIDA (ENTREGA_PARCIAL) → apelable → apelada (Apelación 3)
INSERT IGNORE INTO solicitudes (id_solicitud, expediente, asunto, descripcion, id_ciudadano, id_entidad, fecha_presentacion, fecha_limite, estado, prioridad, formato_digital, formato_fisico, copia_simple, copia_certificada, tipo_informacion)
VALUES (7, 'SAIP-2025-00007',
  'Informes de supervisión penitenciaria 2024',
  'Solicito los informes de supervisión de establecimientos penitenciarios realizados por la EJDF durante el año 2024, incluyendo condiciones de internamiento y recomendaciones emitidas.',
  2, 4, DATE_SUB(NOW(), INTERVAL 30 DAY), DATE_SUB(CURDATE(), INTERVAL 16 DAY),
  'RESPONDIDA', 'ALTA', TRUE, FALSE, TRUE, FALSE, 'Supervisión Penitenciaria');

-- Sol 8: Carlos→EJDF | PENDIENTE_INFORMACION | 6 días calendario → Semáforo ÁMBAR
INSERT IGNORE INTO solicitudes (id_solicitud, expediente, asunto, descripcion, id_ciudadano, id_entidad, fecha_presentacion, fecha_limite, estado, prioridad, formato_digital, formato_fisico, copia_simple, copia_certificada, tipo_informacion)
VALUES (8, 'SAIP-2025-00008',
  'Registro de organizaciones de la sociedad civil',
  'Solicito el registro actualizado de organizaciones de la sociedad civil inscritas ante la EJDF, incluyendo denominación, representante legal y fecha de inscripción.',
  1, 4, DATE_SUB(NOW(), INTERVAL 6 DAY), DATE_ADD(CURDATE(), INTERVAL 6 DAY),
  'PENDIENTE_INFORMACION', 'MEDIA', TRUE, FALSE, TRUE, FALSE, 'Registros Públicos');

-- ============================================
-- 4. RESPUESTAS (3 respuestas, cada una del funcionario de la entidad correcta)
-- ============================================

-- Respuesta Sol 3: ENTREGA_TOTAL por func MDC (id 5 → entidad 3)
INSERT IGNORE INTO respuestas (id_respuesta, id_solicitud, id_funcionario, tipo_respuesta, contenido, fecha_respuesta)
VALUES (1, 3, 5,
  'ENTREGA_TOTAL',
  'Se adjunta copia certificada del Plan de Desarrollo Urbano Metropolitano 2025-2030 aprobado mediante Ordenanza N.° 2456-2025-MDC, incluyendo los 3 anexos de zonificación solicitados. La información se entrega en formato digital (PDF) y físico según lo requerido.',
  DATE_SUB(NOW(), INTERVAL 10 DAY));

-- Respuesta Sol 4: DENEGACION_TOTAL por func ENSAL (id 4 → entidad 2)
INSERT IGNORE INTO respuestas (id_respuesta, id_solicitud, id_funcionario, tipo_respuesta, contenido, causal_denegatoria, fundamento_legal, decision, fecha_respuesta)
VALUES (2, 4, 4,
  'DENEGACION_TOTAL',
  'La información solicitada sobre contratos de adquisición de medicamentos contiene datos protegidos por la excepción de información confidencial referida a secretos comerciales e información reservada vinculada a procesos de selección en curso.',
  'Información confidencial — excepción de secreto comercial e información reservada',
  'Artículo 17, inciso 2 y 4 del TUO de la Ley N.° 27806, Ley de Transparencia y Acceso a la Información Pública',
  'DENEGADA',
  DATE_SUB(NOW(), INTERVAL 13 DAY));

-- Respuesta Sol 7: ENTREGA_PARCIAL por func EJDF (id 6 → entidad 4)
INSERT IGNORE INTO respuestas (id_respuesta, id_solicitud, id_funcionario, tipo_respuesta, contenido, causal_denegatoria, fundamento_legal, fecha_respuesta)
VALUES (3, 7, 6,
  'ENTREGA_PARCIAL',
  'Se entregan los informes de supervisión penitenciaria de los establecimientos de Lima Metropolitana. No se incluyen los informes de establecimientos de provincias ni las recomendaciones internas, por encontrarse en proceso de revisión institucional.',
  'Información parcialmente exceptuada — documentos en proceso de elaboración interna',
  'Artículo 17, inciso 1 del TUO de la Ley N.° 27806',
  DATE_SUB(NOW(), INTERVAL 22 DAY));

-- ============================================
-- 5. APELACIONES TTAIP (3 apelaciones, cubriendo flujos clave)
-- Formato expediente TTAIP: NNNNN-AAAA-JUS-TTAIP
-- ============================================

-- Apelación 1: María apela DENEGACION de sol 4 → EN_CALIFICACION (esperando primera calificación)
INSERT IGNORE INTO apelaciones (id_apelacion, expediente, id_solicitud, id_ciudadano, fundamentos, fecha_apelacion, estado)
VALUES (1, '00001-2025-JUS-TTAIP', 4, 2,
  'Apelo la denegación de mi solicitud SAIP-2025-00004 por improcedente aplicación de la excepción de secreto comercial. Los contratos celebrados con fondos públicos son información de carácter público conforme al artículo 10 del TUO de la Ley N.° 27806. La excepción invocada (Art. 17 inc. 2 y 4) no resulta aplicable a contrataciones estatales sometidas al principio de publicidad de la Ley de Contrataciones del Estado (Ley N.° 30225).',
  DATE_SUB(NOW(), INTERVAL 10 DAY),
  'EN_CALIFICACION');

-- Apelación 2: Carlos apela SILENCIO ADMINISTRATIVO de sol 6 → EN_SUBSANACION (primera calif. fue INADMISIBLE)
-- BR-TTAIP-002: Primera calificación en 7 días
-- BR-TTAIP-003: Subsanación en 2 días hábiles
INSERT IGNORE INTO apelaciones (id_apelacion, expediente, id_solicitud, id_ciudadano, fundamentos, fecha_apelacion, estado, calificacion_primera, fecha_subsanacion, dias_subsanacion)
VALUES (2, '00002-2025-JUS-TTAIP', 6, 1,
  'Apelo ante el Tribunal de Transparencia por silencio administrativo negativo. La Municipalidad Metropolitana de Lima no atendió mi solicitud SAIP-2025-00006 dentro del plazo legal de 10 días hábiles establecido en el artículo 11 del TUO de la Ley N.° 27806, configurándose el silencio administrativo negativo conforme al artículo 11-B de la misma norma.',
  DATE_SUB(NOW(), INTERVAL 15 DAY),
  'EN_SUBSANACION', 'INADMISIBLE',
  DATE_SUB(CURDATE(), INTERVAL 3 DAY), 2);

-- Apelación 3: María apela ENTREGA_PARCIAL de sol 7 → RESUELTO_FUNDADO (ciclo completo terminado)
-- Flujo: INADMISIBLE → EN_SUBSANACION → subsanación → ADMITIDO → resolución FUNDADO
INSERT IGNORE INTO apelaciones (id_apelacion, expediente, id_solicitud, id_ciudadano, fundamentos, fecha_apelacion, estado, calificacion_primera, calificacion_segunda, resultado)
VALUES (3, '00003-2025-JUS-TTAIP', 7, 2,
  'Apelo la respuesta parcial a mi solicitud SAIP-2025-00007. La EJDF entregó únicamente los informes de Lima Metropolitana, excluyendo los de provincias y las recomendaciones internas sin sustento legal válido. La excepción de documentos en elaboración (Art. 17 inc. 1 del TUO) no aplica a informes ya concluidos, conforme al criterio reiterado del TTAIP en resoluciones previas.',
  DATE_SUB(NOW(), INTERVAL 28 DAY),
  'RESUELTO_FUNDADO', 'INADMISIBLE', 'ADMITIDO', 'FUNDADO');

-- ============================================
-- 6. RESOLUCIONES (4 resoluciones vinculadas a las apelaciones calificadas)
-- Mapping: Primera Calif. → PRIMERA_CALIFICACION | Segunda Calif. → SEGUNDA_CALIFICACION | Final → RESOLUCION_FINAL
-- ============================================

-- Resolución 1: Primera calificación de Apelación 2 → INADMISIBLE (requiere subsanación)
INSERT IGNORE INTO resoluciones (id_resolucion, id_apelacion, id_miembro_ttaip, tipo_resolucion, decision, fundamentos, fundamento_legal, fecha_resolucion, observaciones)
VALUES (1, 2, 7,
  'PRIMERA_CALIFICACION', 'INADMISIBLE',
  'Revisado el recurso de apelación interpuesto por el ciudadano Carlos García Rodríguez contra el silencio administrativo de la MDC, se advierte que el escrito no cumple con los requisitos formales establecidos en el TUPA del TTAIP.',
  'Artículo 113 del TUO de la Ley N.° 27444, Ley del Procedimiento Administrativo General',
  DATE_SUB(NOW(), INTERVAL 8 DAY),
  'Se requiere al apelante subsanar las siguientes observaciones en el plazo de 2 días hábiles: 1) Adjuntar copia de la solicitud original SAIP-2025-00006 presentada ante la MDC. 2) Adjuntar cargo de recepción o constancia de presentación. 3) Precisar la fecha exacta de presentación de la solicitud original.');

-- Resolución 2: Primera calificación de Apelación 3 → INADMISIBLE (requirió subsanación, ya subsanada)
INSERT IGNORE INTO resoluciones (id_resolucion, id_apelacion, id_miembro_ttaip, tipo_resolucion, decision, fundamentos, fundamento_legal, fecha_resolucion, observaciones)
VALUES (2, 3, 7,
  'PRIMERA_CALIFICACION', 'INADMISIBLE',
  'Revisado el recurso de apelación de la ciudadana María López Fernández contra la entrega parcial de la EJDF, se advierte incumplimiento de requisitos formales.',
  'Artículo 113 del TUO de la Ley N.° 27444',
  DATE_SUB(NOW(), INTERVAL 22 DAY),
  'Se requiere subsanar: 1) Adjuntar copia de la respuesta parcial recibida de la EJDF. 2) Identificar con precisión la información no entregada.');

-- Resolución 3: Segunda calificación de Apelación 3 → ADMITIDO (subsanación aceptada, procede a trámite)
INSERT IGNORE INTO resoluciones (id_resolucion, id_apelacion, id_miembro_ttaip, tipo_resolucion, decision, fundamentos, fundamento_legal, fecha_resolucion)
VALUES (3, 3, 8,
  'SEGUNDA_CALIFICACION', 'ADMITIDO',
  'Revisada la subsanación presentada por la ciudadana María López Fernández, se verifica el cumplimiento de los requisitos formales. Se admite a trámite el recurso de apelación y se corre traslado a la EJDF para que presente sus descargos en el plazo de 7 días hábiles.',
  'Artículo 218 del TUO de la Ley N.° 27444 y artículo 11-B del TUO de la Ley N.° 27806',
  DATE_SUB(NOW(), INTERVAL 15 DAY));

-- Resolución 4: Resolución Final de Apelación 3 → FUNDADO (ordena entrega de información)
INSERT IGNORE INTO resoluciones (id_resolucion, id_apelacion, id_miembro_ttaip, tipo_resolucion, decision, fundamentos, fundamento_legal, fecha_resolucion, numero_resolucion, causal_fundado, resultado, iniciar_proceso_disciplinario)
VALUES (4, 3, 7,
  'RESOLUCION_FINAL', 'FUNDADO',
  'VISTO el expediente de apelación N.° 00003-2025-JUS-TTAIP interpuesto por la ciudadana María López Fernández contra la respuesta parcial de la Entidad de Justicia y Derechos Fundamentales; y CONSIDERANDO que la entidad no ha acreditado que los informes de supervisión penitenciaria de provincias ni las recomendaciones emitidas se encuentren comprendidos en alguna de las excepciones taxativas del artículo 17 del TUO de la Ley N.° 27806; que la excepción de documentos en proceso de elaboración interna (Art. 17 inc. 1) no resulta aplicable a informes de supervisión ya concluidos y aprobados; SE RESUELVE declarar FUNDADO el recurso de apelación.',
  'Artículos 10, 11-B y 17 del TUO de la Ley N.° 27806; artículo 218 del TUO de la Ley N.° 27444',
  DATE_SUB(NOW(), INTERVAL 5 DAY),
  '000001-2025-JUS/TTAIP-PRIMERA SALA',
  'La entidad invocó indebidamente la excepción de información en elaboración para informes ya concluidos, restringiendo el derecho de acceso a la información pública sin sustento legal válido.',
  'FUNDADO', TRUE);

-- ============================================
-- 7. DOCUMENTOS (4 documentos de referencia)
-- ============================================

INSERT IGNORE INTO documentos (id_documento, nombre_archivo, ruta_archivo, tipo_archivo, tamanio, tipo_documento, fecha_subida, id_solicitud)
VALUES (1, 'solicitud_saip_2025_00001.pdf', '/uploads/solicitudes/1/solicitud_saip_2025_00001.pdf', 'application/pdf', 245760, 'SOLICITUD_ORIGINAL', DATE_SUB(NOW(), INTERVAL 3 DAY), 1);

INSERT IGNORE INTO documentos (id_documento, nombre_archivo, ruta_archivo, tipo_archivo, tamanio, tipo_documento, fecha_subida, id_respuesta)
VALUES (2, 'plan_desarrollo_urbano_2025_2030.pdf', '/uploads/respuestas/1/plan_desarrollo_urbano_2025_2030.pdf', 'application/pdf', 15728640, 'RESPUESTA_ENTIDAD', DATE_SUB(NOW(), INTERVAL 10 DAY), 1);

INSERT IGNORE INTO documentos (id_documento, nombre_archivo, ruta_archivo, tipo_archivo, tamanio, tipo_documento, fecha_subida, id_apelacion)
VALUES (3, 'recurso_apelacion_00001_2025.pdf', '/uploads/apelaciones/1/recurso_apelacion_00001_2025.pdf', 'application/pdf', 524288, 'RECURSO_APELACION', DATE_SUB(NOW(), INTERVAL 10 DAY), 1);

INSERT IGNORE INTO documentos (id_documento, nombre_archivo, ruta_archivo, tipo_archivo, tamanio, tipo_documento, fecha_subida, id_resolucion)
VALUES (4, 'resolucion_000001_2025_primera_sala.pdf', '/uploads/resoluciones/4/resolucion_000001_2025_primera_sala.pdf', 'application/pdf', 1048576, 'RESOLUCION_TTAIP', DATE_SUB(NOW(), INTERVAL 5 DAY), 4);
