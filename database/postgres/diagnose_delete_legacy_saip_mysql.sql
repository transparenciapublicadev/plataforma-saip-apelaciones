-- Read-only diagnosis for deleting the eight known incomplete demo SAIP rows.
-- It returns technical identifiers and aggregate counts only. It never returns
-- names, DNI, email, phone, addresses, document paths, tokens or payloads.

SELECT
    'CANDIDATE' AS section_name,
    s.expediente AS item_name,
    s.id_solicitud AS item_value,
    s.estado,
    DATE_FORMAT(s.fecha_presentacion, '%Y-%m-%d %H:%i:%s') AS fecha_presentacion,
    s.id_entidad,
    s.id_ciudadano,
    COALESCE(CAST(s.consentimiento_datos_personales AS CHAR), 'NULL') AS consentimiento,
    COALESCE(s.canal_notificacion, 'NULL') AS canal
FROM solicitudes s
WHERE s.expediente IN (
    'SAIP-2025-00001',
    'SAIP-2025-00002',
    'SAIP-2025-00003',
    'SAIP-2025-00004',
    'SAIP-2025-00005',
    'SAIP-2025-00006',
    'SAIP-2025-00007',
    'SAIP-2025-00008'
)
  AND s.consentimiento_datos_personales IS NULL
  AND s.canal_notificacion IS NULL
ORDER BY s.expediente;

WITH
candidates AS (
    SELECT id_solicitud, expediente
    FROM solicitudes
    WHERE expediente IN (
        'SAIP-2025-00001',
        'SAIP-2025-00002',
        'SAIP-2025-00003',
        'SAIP-2025-00004',
        'SAIP-2025-00005',
        'SAIP-2025-00006',
        'SAIP-2025-00007',
        'SAIP-2025-00008'
    )
      AND consentimiento_datos_personales IS NULL
      AND canal_notificacion IS NULL
),
responses_target AS (
    SELECT id_respuesta
    FROM respuestas
    WHERE id_solicitud IN (SELECT id_solicitud FROM candidates)
),
appeals_target AS (
    SELECT id_apelacion
    FROM apelaciones
    WHERE id_solicitud IN (SELECT id_solicitud FROM candidates)
),
dossiers_target AS (
    SELECT id_expediente_ttaip
    FROM expedientes_ttaip
    WHERE id_apelacion IN (SELECT id_apelacion FROM appeals_target)
),
resolutions_target AS (
    SELECT id_resolucion
    FROM resoluciones
    WHERE id_apelacion IN (SELECT id_apelacion FROM appeals_target)
       OR id_expediente_ttaip IN (
           SELECT id_expediente_ttaip FROM dossiers_target
       )
),
cedulas_target AS (
    SELECT id_cedula
    FROM cedulas_notificacion
    WHERE id_resolucion IN (SELECT id_resolucion FROM resolutions_target)
),
notifications_target AS (
    SELECT id_notificacion
    FROM notificaciones_ttaip
    WHERE id_expediente_ttaip IN (
              SELECT id_expediente_ttaip FROM dossiers_target
          )
       OR id_cedula IN (SELECT id_cedula FROM cedulas_target)
),
ampliaciones_target AS (
    SELECT id_ampliacion
    FROM ampliaciones_plazo_solicitud
    WHERE id_solicitud IN (SELECT id_solicitud FROM candidates)
),
descargos_target AS (
    SELECT id_descargo
    FROM descargos_entidad_ttaip
    WHERE id_expediente_ttaip IN (
              SELECT id_expediente_ttaip FROM dossiers_target
          )
       OR id_apelacion IN (SELECT id_apelacion FROM appeals_target)
),
reprocesos_target AS (
    SELECT id_reproceso
    FROM reprocesos_notificacion
    WHERE id_expediente_ttaip IN (
              SELECT id_expediente_ttaip FROM dossiers_target
          )
       OR id_notificacion IN (
              SELECT id_notificacion FROM notifications_target
          )
       OR id_notificacion_nueva IN (
              SELECT id_notificacion FROM notifications_target
          )
       OR id_cedula_original IN (SELECT id_cedula FROM cedulas_target)
       OR id_cedula_nueva IN (SELECT id_cedula FROM cedulas_target)
),
documents_target AS (
    SELECT id_documento
    FROM documentos
    WHERE id_solicitud IN (SELECT id_solicitud FROM candidates)
       OR id_respuesta IN (SELECT id_respuesta FROM responses_target)
       OR id_apelacion IN (SELECT id_apelacion FROM appeals_target)
       OR id_resolucion IN (SELECT id_resolucion FROM resolutions_target)
),
dependency_counts AS (
    SELECT 'solicitudes' AS check_name, COUNT(*) AS check_value
    FROM candidates
    UNION ALL
    SELECT 'respuestas', COUNT(*) FROM responses_target
    UNION ALL
    SELECT 'apelaciones', COUNT(*) FROM appeals_target
    UNION ALL
    SELECT 'expedientes_ttaip', COUNT(*) FROM dossiers_target
    UNION ALL
    SELECT 'resoluciones', COUNT(*) FROM resolutions_target
    UNION ALL
    SELECT 'documentos', COUNT(*) FROM documents_target
    UNION ALL
    SELECT 'observaciones_solicitud', COUNT(*)
    FROM observaciones_solicitud
    WHERE id_solicitud IN (SELECT id_solicitud FROM candidates)
    UNION ALL
    SELECT 'ampliaciones_plazo_solicitud', COUNT(*)
    FROM ampliaciones_target
    UNION ALL
    SELECT 'cronograma_entregas_parciales_solicitud', COUNT(*)
    FROM cronograma_entregas_parciales_solicitud
    WHERE id_ampliacion IN (
        SELECT id_ampliacion FROM ampliaciones_target
    )
    UNION ALL
    SELECT 'encauzamientos_solicitud', COUNT(*)
    FROM encauzamientos_solicitud
    WHERE id_solicitud IN (SELECT id_solicitud FROM candidates)
    UNION ALL
    SELECT 'liquidaciones_costo_solicitud', COUNT(*)
    FROM liquidaciones_costo_solicitud
    WHERE id_solicitud IN (SELECT id_solicitud FROM candidates)
    UNION ALL
    SELECT 'elevaciones_apelacion_ttaip', COUNT(*)
    FROM elevaciones_apelacion_ttaip
    WHERE id_apelacion IN (SELECT id_apelacion FROM appeals_target)
    UNION ALL
    SELECT 'expediente_ttaip_miembros', COUNT(*)
    FROM expediente_ttaip_miembros
    WHERE id_expediente_ttaip IN (
        SELECT id_expediente_ttaip FROM dossiers_target
    )
    UNION ALL
    SELECT 'cedulas_notificacion', COUNT(*) FROM cedulas_target
    UNION ALL
    SELECT 'notificaciones_ttaip', COUNT(*) FROM notifications_target
    UNION ALL
    SELECT 'descargos_entidad_ttaip', COUNT(*) FROM descargos_target
    UNION ALL
    SELECT 'suspensiones_plazo_ttaip', COUNT(*)
    FROM suspensiones_plazo_ttaip
    WHERE id_expediente_ttaip IN (
              SELECT id_expediente_ttaip FROM dossiers_target
          )
       OR id_descargo IN (SELECT id_descargo FROM descargos_target)
    UNION ALL
    SELECT 'cumplimientos_resolucion_ttaip', COUNT(*)
    FROM cumplimientos_resolucion_ttaip
    WHERE id_expediente_ttaip IN (
              SELECT id_expediente_ttaip FROM dossiers_target
          )
       OR id_apelacion IN (SELECT id_apelacion FROM appeals_target)
       OR id_resolucion IN (SELECT id_resolucion FROM resolutions_target)
    UNION ALL
    SELECT 'historial_ttaip', COUNT(*)
    FROM historial_ttaip
    WHERE id_expediente_ttaip IN (
        SELECT id_expediente_ttaip FROM dossiers_target
    )
    UNION ALL
    SELECT 'reprocesos_notificacion', COUNT(*) FROM reprocesos_target
    UNION ALL
    SELECT 'intentos_notificacion', COUNT(*)
    FROM intentos_notificacion
    WHERE id_solicitud IN (SELECT id_solicitud FROM candidates)
       OR id_notificacion_ttaip IN (
           SELECT id_notificacion FROM notifications_target
       )
),
ambiguity_checks AS (
    SELECT
        'candidate_set_mismatch' AS check_name,
        CASE
            WHEN COUNT(*) = 8
             AND GROUP_CONCAT(expediente ORDER BY expediente SEPARATOR ',') =
                 'SAIP-2025-00001,SAIP-2025-00002,SAIP-2025-00003,SAIP-2025-00004,SAIP-2025-00005,SAIP-2025-00006,SAIP-2025-00007,SAIP-2025-00008'
            THEN 0
            ELSE 1
        END AS check_value
    FROM candidates
    UNION ALL
    SELECT 'appeals_not_internal', COUNT(*)
    FROM apelaciones
    WHERE id_apelacion IN (SELECT id_apelacion FROM appeals_target)
      AND COALESCE(tipo_origen, 'SAIP_INTERNA') <> 'SAIP_INTERNA'
    UNION ALL
    SELECT 'documents_with_external_parent', COUNT(*)
    FROM documentos d
    WHERE d.id_documento IN (SELECT id_documento FROM documents_target)
      AND (
          (d.id_solicitud IS NOT NULL AND d.id_solicitud NOT IN (
              SELECT id_solicitud FROM candidates
          ))
          OR (d.id_respuesta IS NOT NULL AND d.id_respuesta NOT IN (
              SELECT id_respuesta FROM responses_target
          ))
          OR (d.id_apelacion IS NOT NULL AND d.id_apelacion NOT IN (
              SELECT id_apelacion FROM appeals_target
          ))
          OR (d.id_resolucion IS NOT NULL AND d.id_resolucion NOT IN (
              SELECT id_resolucion FROM resolutions_target
          ))
      )
    UNION ALL
    SELECT 'resolutions_with_external_parent', COUNT(*)
    FROM resoluciones r
    WHERE r.id_resolucion IN (SELECT id_resolucion FROM resolutions_target)
      AND (
          r.id_apelacion NOT IN (SELECT id_apelacion FROM appeals_target)
          OR (
              r.id_expediente_ttaip IS NOT NULL
              AND r.id_expediente_ttaip NOT IN (
                  SELECT id_expediente_ttaip FROM dossiers_target
              )
          )
      )
    UNION ALL
    SELECT 'notifications_with_external_parent', COUNT(*)
    FROM notificaciones_ttaip n
    WHERE n.id_notificacion IN (
              SELECT id_notificacion FROM notifications_target
          )
      AND (
          n.id_expediente_ttaip NOT IN (
              SELECT id_expediente_ttaip FROM dossiers_target
          )
          OR n.id_cedula NOT IN (SELECT id_cedula FROM cedulas_target)
      )
    UNION ALL
    SELECT 'descargos_with_external_parent', COUNT(*)
    FROM descargos_entidad_ttaip d
    WHERE d.id_descargo IN (SELECT id_descargo FROM descargos_target)
      AND (
          d.id_expediente_ttaip NOT IN (
              SELECT id_expediente_ttaip FROM dossiers_target
          )
          OR d.id_apelacion NOT IN (
              SELECT id_apelacion FROM appeals_target
          )
      )
    UNION ALL
    SELECT 'suspensions_with_external_parent', COUNT(*)
    FROM suspensiones_plazo_ttaip s
    WHERE (
              s.id_expediente_ttaip IN (
                  SELECT id_expediente_ttaip FROM dossiers_target
              )
              OR s.id_descargo IN (SELECT id_descargo FROM descargos_target)
          )
      AND (
          s.id_expediente_ttaip NOT IN (
              SELECT id_expediente_ttaip FROM dossiers_target
          )
          OR (
              s.id_descargo IS NOT NULL
              AND s.id_descargo NOT IN (
                  SELECT id_descargo FROM descargos_target
              )
          )
      )
    UNION ALL
    SELECT 'fulfillments_with_external_parent', COUNT(*)
    FROM cumplimientos_resolucion_ttaip c
    WHERE (
              c.id_expediente_ttaip IN (
                  SELECT id_expediente_ttaip FROM dossiers_target
              )
              OR c.id_apelacion IN (
                  SELECT id_apelacion FROM appeals_target
              )
              OR c.id_resolucion IN (
                  SELECT id_resolucion FROM resolutions_target
              )
          )
      AND (
          c.id_expediente_ttaip NOT IN (
              SELECT id_expediente_ttaip FROM dossiers_target
          )
          OR c.id_apelacion NOT IN (
              SELECT id_apelacion FROM appeals_target
          )
          OR c.id_resolucion NOT IN (
              SELECT id_resolucion FROM resolutions_target
          )
      )
    UNION ALL
    SELECT 'reprocesses_with_external_parent', COUNT(*)
    FROM reprocesos_notificacion r
    WHERE r.id_reproceso IN (SELECT id_reproceso FROM reprocesos_target)
      AND (
          r.id_expediente_ttaip NOT IN (
              SELECT id_expediente_ttaip FROM dossiers_target
          )
          OR (
              r.id_notificacion IS NOT NULL
              AND r.id_notificacion NOT IN (
                  SELECT id_notificacion FROM notifications_target
              )
          )
          OR r.id_cedula_original NOT IN (
              SELECT id_cedula FROM cedulas_target
          )
          OR (
              r.id_cedula_nueva IS NOT NULL
              AND r.id_cedula_nueva NOT IN (
                  SELECT id_cedula FROM cedulas_target
              )
          )
          OR (
              r.id_notificacion_nueva IS NOT NULL
              AND r.id_notificacion_nueva NOT IN (
                  SELECT id_notificacion FROM notifications_target
              )
          )
          OR (
              r.id_reproceso_padre IS NOT NULL
              AND r.id_reproceso_padre NOT IN (
                  SELECT id_reproceso FROM reprocesos_target
              )
          )
      )
    UNION ALL
    SELECT 'external_reprocess_children', COUNT(*)
    FROM reprocesos_notificacion r
    WHERE r.id_reproceso_padre IN (
              SELECT id_reproceso FROM reprocesos_target
          )
      AND r.id_reproceso NOT IN (
              SELECT id_reproceso FROM reprocesos_target
          )
    UNION ALL
    SELECT 'unexpected_foreign_key_definitions', COUNT(*)
    FROM information_schema.KEY_COLUMN_USAGE k
    WHERE k.CONSTRAINT_SCHEMA = DATABASE()
      AND k.REFERENCED_TABLE_NAME IN (
          'solicitudes',
          'respuestas',
          'apelaciones',
          'ampliaciones_plazo_solicitud',
          'expedientes_ttaip',
          'resoluciones',
          'cedulas_notificacion',
          'notificaciones_ttaip',
          'descargos_entidad_ttaip',
          'reprocesos_notificacion'
      )
      AND NOT (
          (k.TABLE_NAME = 'respuestas' AND k.COLUMN_NAME = 'id_solicitud' AND k.REFERENCED_TABLE_NAME = 'solicitudes')
          OR (k.TABLE_NAME = 'apelaciones' AND k.COLUMN_NAME = 'id_solicitud' AND k.REFERENCED_TABLE_NAME = 'solicitudes')
          OR (k.TABLE_NAME = 'documentos' AND k.COLUMN_NAME = 'id_solicitud' AND k.REFERENCED_TABLE_NAME = 'solicitudes')
          OR (k.TABLE_NAME = 'observaciones_solicitud' AND k.COLUMN_NAME = 'id_solicitud' AND k.REFERENCED_TABLE_NAME = 'solicitudes')
          OR (k.TABLE_NAME = 'ampliaciones_plazo_solicitud' AND k.COLUMN_NAME = 'id_solicitud' AND k.REFERENCED_TABLE_NAME = 'solicitudes')
          OR (k.TABLE_NAME = 'encauzamientos_solicitud' AND k.COLUMN_NAME = 'id_solicitud' AND k.REFERENCED_TABLE_NAME = 'solicitudes')
          OR (k.TABLE_NAME = 'liquidaciones_costo_solicitud' AND k.COLUMN_NAME = 'id_solicitud' AND k.REFERENCED_TABLE_NAME = 'solicitudes')
          OR (k.TABLE_NAME = 'intentos_notificacion' AND k.COLUMN_NAME = 'id_solicitud' AND k.REFERENCED_TABLE_NAME = 'solicitudes')
          OR (k.TABLE_NAME = 'documentos' AND k.COLUMN_NAME = 'id_respuesta' AND k.REFERENCED_TABLE_NAME = 'respuestas')
          OR (k.TABLE_NAME = 'elevaciones_apelacion_ttaip' AND k.COLUMN_NAME = 'id_apelacion' AND k.REFERENCED_TABLE_NAME = 'apelaciones')
          OR (k.TABLE_NAME = 'expedientes_ttaip' AND k.COLUMN_NAME = 'id_apelacion' AND k.REFERENCED_TABLE_NAME = 'apelaciones')
          OR (k.TABLE_NAME = 'resoluciones' AND k.COLUMN_NAME = 'id_apelacion' AND k.REFERENCED_TABLE_NAME = 'apelaciones')
          OR (k.TABLE_NAME = 'descargos_entidad_ttaip' AND k.COLUMN_NAME = 'id_apelacion' AND k.REFERENCED_TABLE_NAME = 'apelaciones')
          OR (k.TABLE_NAME = 'cumplimientos_resolucion_ttaip' AND k.COLUMN_NAME = 'id_apelacion' AND k.REFERENCED_TABLE_NAME = 'apelaciones')
          OR (k.TABLE_NAME = 'documentos' AND k.COLUMN_NAME = 'id_apelacion' AND k.REFERENCED_TABLE_NAME = 'apelaciones')
          OR (k.TABLE_NAME = 'cronograma_entregas_parciales_solicitud' AND k.COLUMN_NAME = 'id_ampliacion' AND k.REFERENCED_TABLE_NAME = 'ampliaciones_plazo_solicitud')
          OR (k.TABLE_NAME = 'expediente_ttaip_miembros' AND k.COLUMN_NAME = 'id_expediente_ttaip' AND k.REFERENCED_TABLE_NAME = 'expedientes_ttaip')
          OR (k.TABLE_NAME = 'resoluciones' AND k.COLUMN_NAME = 'id_expediente_ttaip' AND k.REFERENCED_TABLE_NAME = 'expedientes_ttaip')
          OR (k.TABLE_NAME = 'notificaciones_ttaip' AND k.COLUMN_NAME = 'id_expediente_ttaip' AND k.REFERENCED_TABLE_NAME = 'expedientes_ttaip')
          OR (k.TABLE_NAME = 'descargos_entidad_ttaip' AND k.COLUMN_NAME = 'id_expediente_ttaip' AND k.REFERENCED_TABLE_NAME = 'expedientes_ttaip')
          OR (k.TABLE_NAME = 'suspensiones_plazo_ttaip' AND k.COLUMN_NAME = 'id_expediente_ttaip' AND k.REFERENCED_TABLE_NAME = 'expedientes_ttaip')
          OR (k.TABLE_NAME = 'cumplimientos_resolucion_ttaip' AND k.COLUMN_NAME = 'id_expediente_ttaip' AND k.REFERENCED_TABLE_NAME = 'expedientes_ttaip')
          OR (k.TABLE_NAME = 'historial_ttaip' AND k.COLUMN_NAME = 'id_expediente_ttaip' AND k.REFERENCED_TABLE_NAME = 'expedientes_ttaip')
          OR (k.TABLE_NAME = 'reprocesos_notificacion' AND k.COLUMN_NAME = 'id_expediente_ttaip' AND k.REFERENCED_TABLE_NAME = 'expedientes_ttaip')
          OR (k.TABLE_NAME = 'cedulas_notificacion' AND k.COLUMN_NAME = 'id_resolucion' AND k.REFERENCED_TABLE_NAME = 'resoluciones')
          OR (k.TABLE_NAME = 'cumplimientos_resolucion_ttaip' AND k.COLUMN_NAME = 'id_resolucion' AND k.REFERENCED_TABLE_NAME = 'resoluciones')
          OR (k.TABLE_NAME = 'documentos' AND k.COLUMN_NAME = 'id_resolucion' AND k.REFERENCED_TABLE_NAME = 'resoluciones')
          OR (k.TABLE_NAME = 'notificaciones_ttaip' AND k.COLUMN_NAME = 'id_cedula' AND k.REFERENCED_TABLE_NAME = 'cedulas_notificacion')
          OR (k.TABLE_NAME = 'reprocesos_notificacion' AND k.COLUMN_NAME IN ('id_cedula_original', 'id_cedula_nueva') AND k.REFERENCED_TABLE_NAME = 'cedulas_notificacion')
          OR (k.TABLE_NAME = 'intentos_notificacion' AND k.COLUMN_NAME = 'id_notificacion_ttaip' AND k.REFERENCED_TABLE_NAME = 'notificaciones_ttaip')
          OR (k.TABLE_NAME = 'reprocesos_notificacion' AND k.COLUMN_NAME IN ('id_notificacion', 'id_notificacion_nueva') AND k.REFERENCED_TABLE_NAME = 'notificaciones_ttaip')
          OR (k.TABLE_NAME = 'suspensiones_plazo_ttaip' AND k.COLUMN_NAME = 'id_descargo' AND k.REFERENCED_TABLE_NAME = 'descargos_entidad_ttaip')
          OR (k.TABLE_NAME = 'reprocesos_notificacion' AND k.COLUMN_NAME = 'id_reproceso_padre' AND k.REFERENCED_TABLE_NAME = 'reprocesos_notificacion')
      )
)
SELECT 'DEPENDENCY' AS section_name, check_name AS item_name, check_value AS item_value
FROM dependency_counts
UNION ALL
SELECT 'AMBIGUITY', check_name, check_value
FROM ambiguity_checks
UNION ALL
SELECT 'GUARD', 'candidate_rows', COUNT(*)
FROM candidates
UNION ALL
SELECT 'GUARD', 'ambiguity_rows', COALESCE(SUM(check_value), 0)
FROM ambiguity_checks
ORDER BY section_name, item_name;
