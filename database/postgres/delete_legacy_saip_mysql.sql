-- Transactional deletion for the eight known incomplete demo SAIP rows.
-- Required session variables:
--   @migration_actor: sanitized operator identifier.
--   @expected_rows: must be exactly 8.
--
-- The runner must execute diagnose_delete_legacy_saip_mysql.sql first and
-- refuse this script when any ambiguity check is non-zero.

CREATE TABLE IF NOT EXISTS auditoria_migracion_saip (
    id_auditoria BIGINT NOT NULL AUTO_INCREMENT,
    codigo_politica VARCHAR(80) NOT NULL,
    actor VARCHAR(120) NOT NULL,
    base_origen VARCHAR(128) NOT NULL,
    motivo VARCHAR(255) NOT NULL,
    cantidad_esperada INT NOT NULL,
    cantidad_afectada INT NOT NULL DEFAULT 0,
    numeros_saip TEXT NOT NULL,
    detalle_tecnico TEXT NULL,
    fecha_aplicacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_auditoria),
    KEY idx_auditoria_migracion_saip_politica (codigo_politica),
    KEY idx_auditoria_migracion_saip_fecha (fecha_aplicacion)
);

CREATE TABLE IF NOT EXISTS auditoria_migracion_saip_detalle (
    id_detalle BIGINT NOT NULL AUTO_INCREMENT,
    id_auditoria BIGINT NOT NULL,
    id_solicitud_original BIGINT NOT NULL,
    numero_saip VARCHAR(50) NOT NULL,
    accion VARCHAR(30) NOT NULL,
    consentimiento_anterior TINYINT(1) NULL,
    canal_anterior VARCHAR(40) NULL,
    consentimiento_nuevo TINYINT(1) NULL,
    canal_nuevo VARCHAR(40) NULL,
    PRIMARY KEY (id_detalle),
    UNIQUE KEY uk_auditoria_saip_detalle (
        id_auditoria,
        id_solicitud_original
    ),
    CONSTRAINT fk_auditoria_saip_detalle_operacion
        FOREIGN KEY (id_auditoria)
        REFERENCES auditoria_migracion_saip (id_auditoria)
);

SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
START TRANSACTION;

CREATE TEMPORARY TABLE tmp_delete_guard (
    assertion_passed TINYINT NOT NULL
);

CREATE TEMPORARY TABLE tmp_delete_candidates (
    id_solicitud BIGINT NOT NULL PRIMARY KEY,
    expediente VARCHAR(50) NOT NULL,
    consentimiento_anterior TINYINT(1) NULL,
    canal_anterior VARCHAR(40) NULL
);

INSERT INTO tmp_delete_candidates (
    id_solicitud,
    expediente,
    consentimiento_anterior,
    canal_anterior
)
SELECT
    id_solicitud,
    expediente,
    consentimiento_datos_personales,
    canal_notificacion
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
FOR UPDATE;

SET @candidate_rows = (
    SELECT COUNT(*) FROM tmp_delete_candidates
);
SET @candidate_numbers = (
    SELECT GROUP_CONCAT(expediente ORDER BY expediente SEPARATOR ',')
    FROM tmp_delete_candidates
);

INSERT INTO tmp_delete_guard (assertion_passed)
VALUES (
    IF(
        @expected_rows = 8
        AND @candidate_rows = @expected_rows
        AND @candidate_numbers =
            'SAIP-2025-00001,SAIP-2025-00002,SAIP-2025-00003,SAIP-2025-00004,SAIP-2025-00005,SAIP-2025-00006,SAIP-2025-00007,SAIP-2025-00008',
        1,
        NULL
    )
);

CREATE TEMPORARY TABLE tmp_delete_responses (
    id_respuesta BIGINT NOT NULL PRIMARY KEY
);
INSERT INTO tmp_delete_responses
SELECT id_respuesta
FROM respuestas
WHERE id_solicitud IN (
    SELECT id_solicitud FROM tmp_delete_candidates
);

CREATE TEMPORARY TABLE tmp_delete_appeals (
    id_apelacion BIGINT NOT NULL PRIMARY KEY
);
INSERT INTO tmp_delete_appeals
SELECT id_apelacion
FROM apelaciones
WHERE id_solicitud IN (
    SELECT id_solicitud FROM tmp_delete_candidates
);

CREATE TEMPORARY TABLE tmp_delete_dossiers (
    id_expediente_ttaip BIGINT NOT NULL PRIMARY KEY
);
INSERT INTO tmp_delete_dossiers
SELECT id_expediente_ttaip
FROM expedientes_ttaip
WHERE id_apelacion IN (
    SELECT id_apelacion FROM tmp_delete_appeals
);

CREATE TEMPORARY TABLE tmp_delete_resolutions (
    id_resolucion BIGINT NOT NULL PRIMARY KEY
);
INSERT INTO tmp_delete_resolutions
SELECT id_resolucion
FROM resoluciones
WHERE id_apelacion IN (
          SELECT id_apelacion FROM tmp_delete_appeals
      )
   OR id_expediente_ttaip IN (
          SELECT id_expediente_ttaip FROM tmp_delete_dossiers
      );

CREATE TEMPORARY TABLE tmp_delete_cedulas (
    id_cedula BIGINT NOT NULL PRIMARY KEY
);
INSERT INTO tmp_delete_cedulas
SELECT id_cedula
FROM cedulas_notificacion
WHERE id_resolucion IN (
    SELECT id_resolucion FROM tmp_delete_resolutions
);

CREATE TEMPORARY TABLE tmp_delete_notifications (
    id_notificacion BIGINT NOT NULL PRIMARY KEY
);
INSERT INTO tmp_delete_notifications
SELECT id_notificacion
FROM notificaciones_ttaip
WHERE id_expediente_ttaip IN (
          SELECT id_expediente_ttaip FROM tmp_delete_dossiers
      )
   OR id_cedula IN (
          SELECT id_cedula FROM tmp_delete_cedulas
      );

CREATE TEMPORARY TABLE tmp_delete_ampliaciones (
    id_ampliacion BIGINT NOT NULL PRIMARY KEY
);
INSERT INTO tmp_delete_ampliaciones
SELECT id_ampliacion
FROM ampliaciones_plazo_solicitud
WHERE id_solicitud IN (
    SELECT id_solicitud FROM tmp_delete_candidates
);

CREATE TEMPORARY TABLE tmp_delete_descargos (
    id_descargo BIGINT NOT NULL PRIMARY KEY
);
INSERT INTO tmp_delete_descargos
SELECT id_descargo
FROM descargos_entidad_ttaip
WHERE id_expediente_ttaip IN (
          SELECT id_expediente_ttaip FROM tmp_delete_dossiers
      )
   OR id_apelacion IN (
          SELECT id_apelacion FROM tmp_delete_appeals
      );

CREATE TEMPORARY TABLE tmp_delete_notifications_alt
SELECT * FROM tmp_delete_notifications;
CREATE TEMPORARY TABLE tmp_delete_cedulas_alt
SELECT * FROM tmp_delete_cedulas;

CREATE TEMPORARY TABLE tmp_delete_reprocesses (
    id_reproceso BIGINT NOT NULL PRIMARY KEY
);
INSERT INTO tmp_delete_reprocesses
SELECT id_reproceso
FROM reprocesos_notificacion
WHERE id_expediente_ttaip IN (
          SELECT id_expediente_ttaip FROM tmp_delete_dossiers
      )
   OR id_notificacion IN (
          SELECT id_notificacion FROM tmp_delete_notifications
      )
   OR id_notificacion_nueva IN (
          SELECT id_notificacion FROM tmp_delete_notifications_alt
      )
   OR id_cedula_original IN (
          SELECT id_cedula FROM tmp_delete_cedulas
      )
   OR id_cedula_nueva IN (
          SELECT id_cedula FROM tmp_delete_cedulas_alt
      );

CREATE TEMPORARY TABLE tmp_delete_documents (
    id_documento BIGINT NOT NULL PRIMARY KEY
);
INSERT INTO tmp_delete_documents
SELECT id_documento
FROM documentos
WHERE id_solicitud IN (
          SELECT id_solicitud FROM tmp_delete_candidates
      )
   OR id_respuesta IN (
          SELECT id_respuesta FROM tmp_delete_responses
      )
   OR id_apelacion IN (
          SELECT id_apelacion FROM tmp_delete_appeals
      )
   OR id_resolucion IN (
          SELECT id_resolucion FROM tmp_delete_resolutions
      );

-- Copies avoid MySQL's temporary-table reopen limitation in mixed-parent checks.
CREATE TEMPORARY TABLE tmp_delete_reprocesses_parent
SELECT * FROM tmp_delete_reprocesses;
CREATE TEMPORARY TABLE tmp_delete_reprocesses_child
SELECT * FROM tmp_delete_reprocesses;
CREATE TEMPORARY TABLE tmp_delete_notifications_original
SELECT * FROM tmp_delete_notifications;
CREATE TEMPORARY TABLE tmp_delete_notifications_new
SELECT * FROM tmp_delete_notifications;
CREATE TEMPORARY TABLE tmp_delete_cedulas_original
SELECT * FROM tmp_delete_cedulas;
CREATE TEMPORARY TABLE tmp_delete_cedulas_new
SELECT * FROM tmp_delete_cedulas;
CREATE TEMPORARY TABLE tmp_delete_dossiers_suspension_scope
SELECT * FROM tmp_delete_dossiers;
CREATE TEMPORARY TABLE tmp_delete_dossiers_suspension_parent
SELECT * FROM tmp_delete_dossiers;
CREATE TEMPORARY TABLE tmp_delete_descargos_suspension_scope
SELECT * FROM tmp_delete_descargos;
CREATE TEMPORARY TABLE tmp_delete_descargos_suspension_parent
SELECT * FROM tmp_delete_descargos;
CREATE TEMPORARY TABLE tmp_delete_dossiers_fulfillment_scope
SELECT * FROM tmp_delete_dossiers;
CREATE TEMPORARY TABLE tmp_delete_dossiers_fulfillment_parent
SELECT * FROM tmp_delete_dossiers;
CREATE TEMPORARY TABLE tmp_delete_appeals_fulfillment_scope
SELECT * FROM tmp_delete_appeals;
CREATE TEMPORARY TABLE tmp_delete_appeals_fulfillment_parent
SELECT * FROM tmp_delete_appeals;
CREATE TEMPORARY TABLE tmp_delete_resolutions_fulfillment_scope
SELECT * FROM tmp_delete_resolutions;
CREATE TEMPORARY TABLE tmp_delete_resolutions_fulfillment_parent
SELECT * FROM tmp_delete_resolutions;

SET @ambiguous_rows = 0;

SELECT @ambiguous_rows := @ambiguous_rows + COUNT(*)
FROM apelaciones
WHERE id_apelacion IN (SELECT id_apelacion FROM tmp_delete_appeals)
  AND COALESCE(tipo_origen, 'SAIP_INTERNA') <> 'SAIP_INTERNA';

SELECT @ambiguous_rows := @ambiguous_rows + COUNT(*)
FROM documentos d
WHERE d.id_documento IN (
          SELECT id_documento FROM tmp_delete_documents
      )
  AND (
      (d.id_solicitud IS NOT NULL AND d.id_solicitud NOT IN (
          SELECT id_solicitud FROM tmp_delete_candidates
      ))
      OR (d.id_respuesta IS NOT NULL AND d.id_respuesta NOT IN (
          SELECT id_respuesta FROM tmp_delete_responses
      ))
      OR (d.id_apelacion IS NOT NULL AND d.id_apelacion NOT IN (
          SELECT id_apelacion FROM tmp_delete_appeals
      ))
      OR (d.id_resolucion IS NOT NULL AND d.id_resolucion NOT IN (
          SELECT id_resolucion FROM tmp_delete_resolutions
      ))
  );

SELECT @ambiguous_rows := @ambiguous_rows + COUNT(*)
FROM resoluciones r
WHERE r.id_resolucion IN (
          SELECT id_resolucion FROM tmp_delete_resolutions
      )
  AND (
      r.id_apelacion NOT IN (
          SELECT id_apelacion FROM tmp_delete_appeals
      )
      OR (
          r.id_expediente_ttaip IS NOT NULL
          AND r.id_expediente_ttaip NOT IN (
              SELECT id_expediente_ttaip FROM tmp_delete_dossiers
          )
      )
  );

SELECT @ambiguous_rows := @ambiguous_rows + COUNT(*)
FROM notificaciones_ttaip n
WHERE n.id_notificacion IN (
          SELECT id_notificacion FROM tmp_delete_notifications
      )
  AND (
      n.id_expediente_ttaip NOT IN (
          SELECT id_expediente_ttaip FROM tmp_delete_dossiers
      )
      OR n.id_cedula NOT IN (
          SELECT id_cedula FROM tmp_delete_cedulas
      )
  );

SELECT @ambiguous_rows := @ambiguous_rows + COUNT(*)
FROM descargos_entidad_ttaip d
WHERE d.id_descargo IN (
          SELECT id_descargo FROM tmp_delete_descargos
      )
  AND (
      d.id_expediente_ttaip NOT IN (
          SELECT id_expediente_ttaip FROM tmp_delete_dossiers
      )
      OR d.id_apelacion NOT IN (
          SELECT id_apelacion FROM tmp_delete_appeals
      )
  );

SELECT @ambiguous_rows := @ambiguous_rows + COUNT(*)
FROM suspensiones_plazo_ttaip s
WHERE (
          s.id_expediente_ttaip IN (
              SELECT id_expediente_ttaip FROM tmp_delete_dossiers_suspension_scope
          )
          OR s.id_descargo IN (
              SELECT id_descargo FROM tmp_delete_descargos_suspension_scope
          )
      )
  AND (
      s.id_expediente_ttaip NOT IN (
          SELECT id_expediente_ttaip FROM tmp_delete_dossiers_suspension_parent
      )
      OR (
          s.id_descargo IS NOT NULL
          AND s.id_descargo NOT IN (
              SELECT id_descargo FROM tmp_delete_descargos_suspension_parent
          )
      )
  );

SELECT @ambiguous_rows := @ambiguous_rows + COUNT(*)
FROM cumplimientos_resolucion_ttaip c
WHERE (
          c.id_expediente_ttaip IN (
              SELECT id_expediente_ttaip FROM tmp_delete_dossiers_fulfillment_scope
          )
          OR c.id_apelacion IN (
              SELECT id_apelacion FROM tmp_delete_appeals_fulfillment_scope
          )
          OR c.id_resolucion IN (
              SELECT id_resolucion FROM tmp_delete_resolutions_fulfillment_scope
          )
      )
  AND (
      c.id_expediente_ttaip NOT IN (
          SELECT id_expediente_ttaip FROM tmp_delete_dossiers_fulfillment_parent
      )
      OR c.id_apelacion NOT IN (
          SELECT id_apelacion FROM tmp_delete_appeals_fulfillment_parent
      )
      OR c.id_resolucion NOT IN (
          SELECT id_resolucion FROM tmp_delete_resolutions_fulfillment_parent
      )
  );

SELECT @ambiguous_rows := @ambiguous_rows + COUNT(*)
FROM reprocesos_notificacion r
WHERE r.id_reproceso IN (
          SELECT id_reproceso FROM tmp_delete_reprocesses
      )
  AND (
      r.id_expediente_ttaip NOT IN (
          SELECT id_expediente_ttaip FROM tmp_delete_dossiers
      )
      OR (
          r.id_notificacion IS NOT NULL
          AND r.id_notificacion NOT IN (
              SELECT id_notificacion FROM tmp_delete_notifications_original
          )
      )
      OR r.id_cedula_original NOT IN (
          SELECT id_cedula FROM tmp_delete_cedulas_original
      )
      OR (
          r.id_cedula_nueva IS NOT NULL
          AND r.id_cedula_nueva NOT IN (
              SELECT id_cedula FROM tmp_delete_cedulas_new
          )
      )
      OR (
          r.id_notificacion_nueva IS NOT NULL
          AND r.id_notificacion_nueva NOT IN (
              SELECT id_notificacion FROM tmp_delete_notifications_new
          )
      )
      OR (
          r.id_reproceso_padre IS NOT NULL
          AND r.id_reproceso_padre NOT IN (
              SELECT id_reproceso FROM tmp_delete_reprocesses_parent
          )
      )
  );

SELECT @ambiguous_rows := @ambiguous_rows + COUNT(*)
FROM reprocesos_notificacion r
WHERE r.id_reproceso_padre IN (
          SELECT id_reproceso FROM tmp_delete_reprocesses_child
      )
  AND r.id_reproceso NOT IN (
          SELECT id_reproceso FROM tmp_delete_reprocesses
      );

INSERT INTO tmp_delete_guard (assertion_passed)
VALUES (IF(@ambiguous_rows = 0, 1, NULL));

INSERT INTO auditoria_migracion_saip (
    codigo_politica,
    actor,
    base_origen,
    motivo,
    cantidad_esperada,
    cantidad_afectada,
    numeros_saip,
    detalle_tecnico
)
VALUES (
    'DELETE_LEGACY_INCOMPLETE_SAIP',
    @migration_actor,
    DATABASE(),
    'MIGRACION_POSTGRESQL_LEGACY_INCOMPLETE_RECORDS',
    @expected_rows,
    0,
    @candidate_numbers,
    'ELIMINACION_TRANSACCIONAL_DE_SUBGRAFO_DEMO'
);

SET @audit_id = LAST_INSERT_ID();

INSERT INTO auditoria_migracion_saip_detalle (
    id_auditoria,
    id_solicitud_original,
    numero_saip,
    accion,
    consentimiento_anterior,
    canal_anterior
)
SELECT
    @audit_id,
    id_solicitud,
    expediente,
    'DELETE',
    consentimiento_anterior,
    canal_anterior
FROM tmp_delete_candidates;

DELETE FROM intentos_notificacion
WHERE id_solicitud IN (
          SELECT id_solicitud FROM tmp_delete_candidates
      )
   OR id_notificacion_ttaip IN (
          SELECT id_notificacion FROM tmp_delete_notifications
      );
SET @deleted_intentos = ROW_COUNT();

UPDATE reprocesos_notificacion
SET id_reproceso_padre = NULL
WHERE id_reproceso IN (
    SELECT id_reproceso FROM tmp_delete_reprocesses
);

DELETE FROM reprocesos_notificacion
WHERE id_reproceso IN (
    SELECT id_reproceso FROM tmp_delete_reprocesses
);
SET @deleted_reprocesos = ROW_COUNT();

DELETE FROM suspensiones_plazo_ttaip
WHERE id_expediente_ttaip IN (
          SELECT id_expediente_ttaip FROM tmp_delete_dossiers
      )
   OR id_descargo IN (
          SELECT id_descargo FROM tmp_delete_descargos
      );
SET @deleted_suspensiones = ROW_COUNT();

DELETE FROM cumplimientos_resolucion_ttaip
WHERE id_expediente_ttaip IN (
          SELECT id_expediente_ttaip FROM tmp_delete_dossiers
      )
   OR id_apelacion IN (
          SELECT id_apelacion FROM tmp_delete_appeals
      )
   OR id_resolucion IN (
          SELECT id_resolucion FROM tmp_delete_resolutions
      );
SET @deleted_cumplimientos = ROW_COUNT();

DELETE FROM historial_ttaip
WHERE id_expediente_ttaip IN (
    SELECT id_expediente_ttaip FROM tmp_delete_dossiers
);
SET @deleted_historial = ROW_COUNT();

DELETE FROM documentos
WHERE id_documento IN (
    SELECT id_documento FROM tmp_delete_documents
);
SET @deleted_documentos = ROW_COUNT();

DELETE FROM descargos_entidad_ttaip
WHERE id_descargo IN (
    SELECT id_descargo FROM tmp_delete_descargos
);
SET @deleted_descargos = ROW_COUNT();

DELETE FROM notificaciones_ttaip
WHERE id_notificacion IN (
    SELECT id_notificacion FROM tmp_delete_notifications
);
SET @deleted_notificaciones = ROW_COUNT();

DELETE FROM cedulas_notificacion
WHERE id_cedula IN (
    SELECT id_cedula FROM tmp_delete_cedulas
);
SET @deleted_cedulas = ROW_COUNT();

DELETE FROM cronograma_entregas_parciales_solicitud
WHERE id_ampliacion IN (
    SELECT id_ampliacion FROM tmp_delete_ampliaciones
);
SET @deleted_cronograma = ROW_COUNT();

DELETE FROM observaciones_solicitud
WHERE id_solicitud IN (
    SELECT id_solicitud FROM tmp_delete_candidates
);
SET @deleted_observaciones = ROW_COUNT();

DELETE FROM encauzamientos_solicitud
WHERE id_solicitud IN (
    SELECT id_solicitud FROM tmp_delete_candidates
);
SET @deleted_encauzamientos = ROW_COUNT();

DELETE FROM liquidaciones_costo_solicitud
WHERE id_solicitud IN (
    SELECT id_solicitud FROM tmp_delete_candidates
);
SET @deleted_liquidaciones = ROW_COUNT();

DELETE FROM expediente_ttaip_miembros
WHERE id_expediente_ttaip IN (
    SELECT id_expediente_ttaip FROM tmp_delete_dossiers
);
SET @deleted_expediente_miembros = ROW_COUNT();

DELETE FROM elevaciones_apelacion_ttaip
WHERE id_apelacion IN (
    SELECT id_apelacion FROM tmp_delete_appeals
);
SET @deleted_elevaciones = ROW_COUNT();

DELETE FROM resoluciones
WHERE id_resolucion IN (
    SELECT id_resolucion FROM tmp_delete_resolutions
);
SET @deleted_resoluciones = ROW_COUNT();

DELETE FROM expedientes_ttaip
WHERE id_expediente_ttaip IN (
    SELECT id_expediente_ttaip FROM tmp_delete_dossiers
);
SET @deleted_expedientes = ROW_COUNT();

DELETE FROM respuestas
WHERE id_respuesta IN (
    SELECT id_respuesta FROM tmp_delete_responses
);
SET @deleted_respuestas = ROW_COUNT();

DELETE FROM apelaciones
WHERE id_apelacion IN (
    SELECT id_apelacion FROM tmp_delete_appeals
);
SET @deleted_apelaciones = ROW_COUNT();

DELETE FROM ampliaciones_plazo_solicitud
WHERE id_ampliacion IN (
    SELECT id_ampliacion FROM tmp_delete_ampliaciones
);
SET @deleted_ampliaciones = ROW_COUNT();

DELETE FROM solicitudes
WHERE id_solicitud IN (
    SELECT id_solicitud FROM tmp_delete_candidates
);
SET @deleted_solicitudes = ROW_COUNT();

SET @remaining_candidates = (
    SELECT COUNT(*)
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
);

INSERT INTO tmp_delete_guard (assertion_passed)
VALUES (
    IF(
        @deleted_solicitudes = @expected_rows
        AND @remaining_candidates = 0,
        1,
        NULL
    )
);

UPDATE auditoria_migracion_saip
SET cantidad_afectada = @deleted_solicitudes
WHERE id_auditoria = @audit_id;

COMMIT;

SELECT 'solicitudes' AS table_name, @deleted_solicitudes AS deleted_rows
UNION ALL SELECT 'respuestas', @deleted_respuestas
UNION ALL SELECT 'apelaciones', @deleted_apelaciones
UNION ALL SELECT 'expedientes_ttaip', @deleted_expedientes
UNION ALL SELECT 'resoluciones', @deleted_resoluciones
UNION ALL SELECT 'documentos', @deleted_documentos
UNION ALL SELECT 'observaciones_solicitud', @deleted_observaciones
UNION ALL SELECT 'ampliaciones_plazo_solicitud', @deleted_ampliaciones
UNION ALL SELECT 'cronograma_entregas_parciales_solicitud', @deleted_cronograma
UNION ALL SELECT 'encauzamientos_solicitud', @deleted_encauzamientos
UNION ALL SELECT 'liquidaciones_costo_solicitud', @deleted_liquidaciones
UNION ALL SELECT 'elevaciones_apelacion_ttaip', @deleted_elevaciones
UNION ALL SELECT 'expediente_ttaip_miembros', @deleted_expediente_miembros
UNION ALL SELECT 'cedulas_notificacion', @deleted_cedulas
UNION ALL SELECT 'notificaciones_ttaip', @deleted_notificaciones
UNION ALL SELECT 'descargos_entidad_ttaip', @deleted_descargos
UNION ALL SELECT 'suspensiones_plazo_ttaip', @deleted_suspensiones
UNION ALL SELECT 'cumplimientos_resolucion_ttaip', @deleted_cumplimientos
UNION ALL SELECT 'historial_ttaip', @deleted_historial
UNION ALL SELECT 'reprocesos_notificacion', @deleted_reprocesos
UNION ALL SELECT 'intentos_notificacion', @deleted_intentos
UNION ALL SELECT 'remaining_candidates', @remaining_candidates;
