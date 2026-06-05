-- Read-only validation after loading a PostgreSQL rehearsal database.
-- Output columns: section, check_name, value.
-- TABLE_COUNT rows are informational. Every other row reports violations.

SELECT 'TABLE_COUNT', 'usuarios', COUNT(*) FROM usuarios
UNION ALL SELECT 'TABLE_COUNT', 'entidades', COUNT(*) FROM entidades
UNION ALL SELECT 'TABLE_COUNT', 'ciudadanos', COUNT(*) FROM ciudadanos
UNION ALL SELECT 'TABLE_COUNT', 'funcionarios', COUNT(*) FROM funcionarios
UNION ALL SELECT 'TABLE_COUNT', 'administradores', COUNT(*) FROM administradores
UNION ALL SELECT 'TABLE_COUNT', 'miembros_ttaip', COUNT(*) FROM miembros_ttaip
UNION ALL SELECT 'TABLE_COUNT', 'solicitudes', COUNT(*) FROM solicitudes
UNION ALL SELECT 'TABLE_COUNT', 'respuestas', COUNT(*) FROM respuestas
UNION ALL SELECT 'TABLE_COUNT', 'apelaciones', COUNT(*) FROM apelaciones
UNION ALL SELECT 'TABLE_COUNT', 'documentos', COUNT(*) FROM documentos
UNION ALL SELECT 'TABLE_COUNT', 'observaciones_solicitud', COUNT(*) FROM observaciones_solicitud
UNION ALL SELECT 'TABLE_COUNT', 'ampliaciones_plazo_solicitud', COUNT(*) FROM ampliaciones_plazo_solicitud
UNION ALL SELECT 'TABLE_COUNT', 'cronograma_entregas_parciales_solicitud', COUNT(*) FROM cronograma_entregas_parciales_solicitud
UNION ALL SELECT 'TABLE_COUNT', 'encauzamientos_solicitud', COUNT(*) FROM encauzamientos_solicitud
UNION ALL SELECT 'TABLE_COUNT', 'liquidaciones_costo_solicitud', COUNT(*) FROM liquidaciones_costo_solicitud
UNION ALL SELECT 'TABLE_COUNT', 'elevaciones_apelacion_ttaip', COUNT(*) FROM elevaciones_apelacion_ttaip
UNION ALL SELECT 'TABLE_COUNT', 'salas_ttaip', COUNT(*) FROM salas_ttaip
UNION ALL SELECT 'TABLE_COUNT', 'expedientes_ttaip', COUNT(*) FROM expedientes_ttaip
UNION ALL SELECT 'TABLE_COUNT', 'expediente_ttaip_miembros', COUNT(*) FROM expediente_ttaip_miembros
UNION ALL SELECT 'TABLE_COUNT', 'resoluciones', COUNT(*) FROM resoluciones
UNION ALL SELECT 'TABLE_COUNT', 'cedulas_notificacion', COUNT(*) FROM cedulas_notificacion
UNION ALL SELECT 'TABLE_COUNT', 'notificaciones_ttaip', COUNT(*) FROM notificaciones_ttaip
UNION ALL SELECT 'TABLE_COUNT', 'descargos_entidad_ttaip', COUNT(*) FROM descargos_entidad_ttaip
UNION ALL SELECT 'TABLE_COUNT', 'suspensiones_plazo_ttaip', COUNT(*) FROM suspensiones_plazo_ttaip
UNION ALL SELECT 'TABLE_COUNT', 'cumplimientos_resolucion_ttaip', COUNT(*) FROM cumplimientos_resolucion_ttaip
UNION ALL SELECT 'TABLE_COUNT', 'historial_ttaip', COUNT(*) FROM historial_ttaip
UNION ALL SELECT 'TABLE_COUNT', 'reprocesos_notificacion', COUNT(*) FROM reprocesos_notificacion
UNION ALL SELECT 'TABLE_COUNT', 'intentos_notificacion', COUNT(*) FROM intentos_notificacion
UNION ALL SELECT 'TABLE_COUNT', 'dispositivos_notificacion_push', COUNT(*) FROM dispositivos_notificacion_push

UNION ALL
SELECT 'CASE_INSENSITIVE', 'usuarios.email duplicate groups', COUNT(*)
FROM (
    SELECT LOWER(BTRIM(email))
    FROM usuarios
    GROUP BY LOWER(BTRIM(email))
    HAVING COUNT(*) > 1
) duplicate_emails
UNION ALL
SELECT 'CASE_INSENSITIVE', 'entidades.acronimo duplicate groups', COUNT(*)
FROM (
    SELECT LOWER(BTRIM(acronimo))
    FROM entidades
    GROUP BY LOWER(BTRIM(acronimo))
    HAVING COUNT(*) > 1
) duplicate_acronyms

UNION ALL
SELECT 'ORPHAN', 'ciudadanos -> usuarios', COUNT(*)
FROM ciudadanos child LEFT JOIN usuarios parent ON parent.id_usuario = child.id_usuario
WHERE parent.id_usuario IS NULL
UNION ALL
SELECT 'ORPHAN', 'funcionarios -> usuarios', COUNT(*)
FROM funcionarios child LEFT JOIN usuarios parent ON parent.id_usuario = child.id_usuario
WHERE parent.id_usuario IS NULL
UNION ALL
SELECT 'ORPHAN', 'funcionarios -> entidades', COUNT(*)
FROM funcionarios child LEFT JOIN entidades parent ON parent.id_entidad = child.id_entidad
WHERE parent.id_entidad IS NULL
UNION ALL
SELECT 'ORPHAN', 'administradores -> usuarios', COUNT(*)
FROM administradores child LEFT JOIN usuarios parent ON parent.id_usuario = child.id_usuario
WHERE parent.id_usuario IS NULL
UNION ALL
SELECT 'ORPHAN', 'miembros_ttaip -> usuarios', COUNT(*)
FROM miembros_ttaip child LEFT JOIN usuarios parent ON parent.id_usuario = child.id_usuario
WHERE parent.id_usuario IS NULL
UNION ALL
SELECT 'ORPHAN', 'solicitudes -> ciudadanos', COUNT(*)
FROM solicitudes child LEFT JOIN ciudadanos parent ON parent.id_usuario = child.id_ciudadano
WHERE parent.id_usuario IS NULL
UNION ALL
SELECT 'ORPHAN', 'solicitudes -> entidades', COUNT(*)
FROM solicitudes child LEFT JOIN entidades parent ON parent.id_entidad = child.id_entidad
WHERE parent.id_entidad IS NULL
UNION ALL
SELECT 'ORPHAN', 'respuestas -> solicitudes', COUNT(*)
FROM respuestas child LEFT JOIN solicitudes parent ON parent.id_solicitud = child.id_solicitud
WHERE parent.id_solicitud IS NULL
UNION ALL
SELECT 'ORPHAN', 'respuestas -> funcionarios', COUNT(*)
FROM respuestas child LEFT JOIN funcionarios parent ON parent.id_usuario = child.id_funcionario
WHERE parent.id_usuario IS NULL
UNION ALL
SELECT 'ORPHAN', 'apelaciones -> solicitudes', COUNT(*)
FROM apelaciones child LEFT JOIN solicitudes parent ON parent.id_solicitud = child.id_solicitud
WHERE child.id_solicitud IS NOT NULL AND parent.id_solicitud IS NULL
UNION ALL
SELECT 'ORPHAN', 'apelaciones -> ciudadanos', COUNT(*)
FROM apelaciones child LEFT JOIN ciudadanos parent ON parent.id_usuario = child.id_ciudadano
WHERE parent.id_usuario IS NULL
UNION ALL
SELECT 'ORPHAN', 'apelaciones -> entidades', COUNT(*)
FROM apelaciones child LEFT JOIN entidades parent ON parent.id_entidad = child.id_entidad_apelada
WHERE child.id_entidad_apelada IS NOT NULL AND parent.id_entidad IS NULL
UNION ALL
SELECT 'ORPHAN', 'expedientes_ttaip -> apelaciones', COUNT(*)
FROM expedientes_ttaip child LEFT JOIN apelaciones parent ON parent.id_apelacion = child.id_apelacion
WHERE parent.id_apelacion IS NULL
UNION ALL
SELECT 'ORPHAN', 'expedientes_ttaip -> salas_ttaip', COUNT(*)
FROM expedientes_ttaip child LEFT JOIN salas_ttaip parent ON parent.id_sala_ttaip = child.id_sala_ttaip
WHERE parent.id_sala_ttaip IS NULL
UNION ALL
SELECT 'ORPHAN', 'resoluciones -> apelaciones', COUNT(*)
FROM resoluciones child LEFT JOIN apelaciones parent ON parent.id_apelacion = child.id_apelacion
WHERE parent.id_apelacion IS NULL
UNION ALL
SELECT 'ORPHAN', 'resoluciones -> expedientes_ttaip', COUNT(*)
FROM resoluciones child LEFT JOIN expedientes_ttaip parent ON parent.id_expediente_ttaip = child.id_expediente_ttaip
WHERE child.id_expediente_ttaip IS NOT NULL AND parent.id_expediente_ttaip IS NULL
UNION ALL
SELECT 'ORPHAN', 'resoluciones -> salas_ttaip', COUNT(*)
FROM resoluciones child LEFT JOIN salas_ttaip parent ON parent.id_sala_ttaip = child.id_sala_ttaip
WHERE child.id_sala_ttaip IS NOT NULL AND parent.id_sala_ttaip IS NULL
UNION ALL
SELECT 'ORPHAN', 'resoluciones -> miembros_ttaip', COUNT(*)
FROM resoluciones child LEFT JOIN miembros_ttaip parent ON parent.id_usuario = child.id_miembro_ttaip
WHERE child.id_miembro_ttaip IS NOT NULL AND parent.id_usuario IS NULL
UNION ALL
SELECT 'ORPHAN', 'cedulas_notificacion -> resoluciones', COUNT(*)
FROM cedulas_notificacion child LEFT JOIN resoluciones parent ON parent.id_resolucion = child.id_resolucion
WHERE parent.id_resolucion IS NULL
UNION ALL
SELECT 'ORPHAN', 'notificaciones_ttaip -> expedientes_ttaip', COUNT(*)
FROM notificaciones_ttaip child LEFT JOIN expedientes_ttaip parent ON parent.id_expediente_ttaip = child.id_expediente_ttaip
WHERE parent.id_expediente_ttaip IS NULL
UNION ALL
SELECT 'ORPHAN', 'notificaciones_ttaip -> cedulas_notificacion', COUNT(*)
FROM notificaciones_ttaip child LEFT JOIN cedulas_notificacion parent ON parent.id_cedula = child.id_cedula
WHERE parent.id_cedula IS NULL
UNION ALL
SELECT 'ORPHAN', 'reprocesos -> expediente', COUNT(*)
FROM reprocesos_notificacion child LEFT JOIN expedientes_ttaip parent ON parent.id_expediente_ttaip = child.id_expediente_ttaip
WHERE parent.id_expediente_ttaip IS NULL
UNION ALL
SELECT 'ORPHAN', 'reprocesos -> notificacion original', COUNT(*)
FROM reprocesos_notificacion child LEFT JOIN notificaciones_ttaip parent ON parent.id_notificacion = child.id_notificacion
WHERE child.id_notificacion IS NOT NULL AND parent.id_notificacion IS NULL
UNION ALL
SELECT 'ORPHAN', 'reprocesos -> cedula original', COUNT(*)
FROM reprocesos_notificacion child LEFT JOIN cedulas_notificacion parent ON parent.id_cedula = child.id_cedula_original
WHERE parent.id_cedula IS NULL
UNION ALL
SELECT 'ORPHAN', 'reprocesos -> cedula nueva', COUNT(*)
FROM reprocesos_notificacion child LEFT JOIN cedulas_notificacion parent ON parent.id_cedula = child.id_cedula_nueva
WHERE child.id_cedula_nueva IS NOT NULL AND parent.id_cedula IS NULL
UNION ALL
SELECT 'ORPHAN', 'reprocesos -> notificacion nueva', COUNT(*)
FROM reprocesos_notificacion child LEFT JOIN notificaciones_ttaip parent ON parent.id_notificacion = child.id_notificacion_nueva
WHERE child.id_notificacion_nueva IS NOT NULL AND parent.id_notificacion IS NULL
UNION ALL
SELECT 'ORPHAN', 'reprocesos -> reproceso padre', COUNT(*)
FROM reprocesos_notificacion child LEFT JOIN reprocesos_notificacion parent ON parent.id_reproceso = child.id_reproceso_padre
WHERE child.id_reproceso_padre IS NOT NULL AND parent.id_reproceso IS NULL
UNION ALL
SELECT 'ORPHAN', 'descargos -> expediente', COUNT(*)
FROM descargos_entidad_ttaip child LEFT JOIN expedientes_ttaip parent ON parent.id_expediente_ttaip = child.id_expediente_ttaip
WHERE parent.id_expediente_ttaip IS NULL
UNION ALL
SELECT 'ORPHAN', 'descargos -> apelacion', COUNT(*)
FROM descargos_entidad_ttaip child LEFT JOIN apelaciones parent ON parent.id_apelacion = child.id_apelacion
WHERE parent.id_apelacion IS NULL
UNION ALL
SELECT 'ORPHAN', 'descargos -> entidad', COUNT(*)
FROM descargos_entidad_ttaip child LEFT JOIN entidades parent ON parent.id_entidad = child.id_entidad
WHERE parent.id_entidad IS NULL
UNION ALL
SELECT 'ORPHAN', 'suspensiones -> expediente', COUNT(*)
FROM suspensiones_plazo_ttaip child LEFT JOIN expedientes_ttaip parent ON parent.id_expediente_ttaip = child.id_expediente_ttaip
WHERE parent.id_expediente_ttaip IS NULL
UNION ALL
SELECT 'ORPHAN', 'suspensiones -> descargo', COUNT(*)
FROM suspensiones_plazo_ttaip child LEFT JOIN descargos_entidad_ttaip parent ON parent.id_descargo = child.id_descargo
WHERE child.id_descargo IS NOT NULL AND parent.id_descargo IS NULL
UNION ALL
SELECT 'ORPHAN', 'cumplimientos -> expediente', COUNT(*)
FROM cumplimientos_resolucion_ttaip child LEFT JOIN expedientes_ttaip parent ON parent.id_expediente_ttaip = child.id_expediente_ttaip
WHERE parent.id_expediente_ttaip IS NULL
UNION ALL
SELECT 'ORPHAN', 'cumplimientos -> apelacion', COUNT(*)
FROM cumplimientos_resolucion_ttaip child LEFT JOIN apelaciones parent ON parent.id_apelacion = child.id_apelacion
WHERE parent.id_apelacion IS NULL
UNION ALL
SELECT 'ORPHAN', 'cumplimientos -> resolucion', COUNT(*)
FROM cumplimientos_resolucion_ttaip child LEFT JOIN resoluciones parent ON parent.id_resolucion = child.id_resolucion
WHERE parent.id_resolucion IS NULL
UNION ALL
SELECT 'ORPHAN', 'cumplimientos -> entidad', COUNT(*)
FROM cumplimientos_resolucion_ttaip child LEFT JOIN entidades parent ON parent.id_entidad = child.id_entidad
WHERE parent.id_entidad IS NULL
UNION ALL
SELECT 'ORPHAN', 'historial -> expediente', COUNT(*)
FROM historial_ttaip child LEFT JOIN expedientes_ttaip parent ON parent.id_expediente_ttaip = child.id_expediente_ttaip
WHERE parent.id_expediente_ttaip IS NULL
UNION ALL
SELECT 'ORPHAN', 'dispositivos push -> usuarios', COUNT(*)
FROM dispositivos_notificacion_push child LEFT JOIN usuarios parent ON parent.id_usuario = child.id_usuario
WHERE parent.id_usuario IS NULL

UNION ALL
SELECT 'CONSISTENCY', 'notificacion expediente matches cedula resolution', COUNT(*)
FROM notificaciones_ttaip notification
JOIN cedulas_notificacion cedula ON cedula.id_cedula = notification.id_cedula
JOIN resoluciones resolution ON resolution.id_resolucion = cedula.id_resolucion
WHERE resolution.id_expediente_ttaip IS NOT NULL
  AND resolution.id_expediente_ttaip <> notification.id_expediente_ttaip
UNION ALL
SELECT 'CONSISTENCY', 'descargo appeal matches expediente', COUNT(*)
FROM descargos_entidad_ttaip descargo
JOIN expedientes_ttaip expediente ON expediente.id_expediente_ttaip = descargo.id_expediente_ttaip
WHERE expediente.id_apelacion <> descargo.id_apelacion
UNION ALL
SELECT 'CONSISTENCY', 'cumplimiento appeal matches expediente', COUNT(*)
FROM cumplimientos_resolucion_ttaip cumplimiento
JOIN expedientes_ttaip expediente ON expediente.id_expediente_ttaip = cumplimiento.id_expediente_ttaip
WHERE expediente.id_apelacion <> cumplimiento.id_apelacion
UNION ALL
SELECT 'CONSISTENCY', 'cumplimiento resolution matches expediente', COUNT(*)
FROM cumplimientos_resolucion_ttaip cumplimiento
JOIN resoluciones resolution ON resolution.id_resolucion = cumplimiento.id_resolucion
WHERE resolution.id_expediente_ttaip IS NOT NULL
  AND resolution.id_expediente_ttaip <> cumplimiento.id_expediente_ttaip
ORDER BY 1, 2;
