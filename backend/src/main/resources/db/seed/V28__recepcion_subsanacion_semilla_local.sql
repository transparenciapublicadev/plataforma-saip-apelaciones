-- The local seed put 01561 and 01562 past an inadmissible first qualification
-- and recorded fecha_subsanacion, but the receipt table did not exist yet.
-- Second qualification only happens together with that receipt. This completes
-- those two local rows. A database without them is unchanged.

INSERT INTO recepciones_subsanacion_ttaip (
    id_requerimiento, id_creado_por, clave_operacion, huella_solicitud, fecha_recepcion, fundamentos
)
SELECT r.id_resolucion,
       a.id_ciudadano,
       v.clave,
       v.huella,
       COALESCE(a.fecha_subsanacion::timestamp, r.fecha_resolucion),
       v.fundamentos
FROM (VALUES
    ('01561-2025-JUS/TTAIP',
     'c3a1e561-2025-4a15-8a61-000000015561',
     'c0d0ef1f71505957bf8df6c6c6535e2706e2c21cd68fa71b06eb3eb75275b64d',
     'Se presentan fundamentos adicionales para subsanar las observaciones notificadas por el Tribunal.'),
    ('01562-2025-JUS/TTAIP',
     'c3a1e562-2025-4a15-8a62-000000015562',
     '451c9d0d7e18552e2889c2c6b3d2a5c00b5615bc731ba66bc6889465eb76f09c',
     'Apelo la respuesta emitida y adjunto subsanacion para que el Tribunal emita pronunciamiento de fondo.')
) AS v(expediente, clave, huella, fundamentos)
JOIN apelaciones a ON a.expediente = v.expediente
JOIN resoluciones r ON r.id_apelacion = a.id_apelacion
    AND r.tipo_resolucion = 'PRIMERA_CALIFICACION'
    AND r.decision = 'INADMISIBLE'
WHERE a.calificacion_primera = 'INADMISIBLE'
  AND a.fecha_subsanacion IS NOT NULL
  AND a.id_ciudadano IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM recepciones_subsanacion_ttaip existente
      WHERE existente.id_requerimiento = r.id_resolucion
  );

INSERT INTO historial_ttaip (
    id_expediente_ttaip, tipo_evento, descripcion, estado_anterior, estado_nuevo, actor, referencia, fecha_evento
)
SELECT et.id_expediente_ttaip,
       'SUBSANACION',
       'Subsanación recibida para requerimiento ' || r.id_resolucion,
       'EN_SUBSANACION',
       'EN_CALIFICACION_2',
       'saip:user:v1:' || a.id_ciudadano,
       rec.clave_operacion,
       rec.fecha_recepcion
FROM recepciones_subsanacion_ttaip rec
JOIN resoluciones r ON r.id_resolucion = rec.id_requerimiento
JOIN apelaciones a ON a.id_apelacion = r.id_apelacion
JOIN expedientes_ttaip et ON et.id_apelacion = a.id_apelacion
WHERE rec.clave_operacion IN (
    'c3a1e561-2025-4a15-8a61-000000015561',
    'c3a1e562-2025-4a15-8a62-000000015562'
)
AND NOT EXISTS (
    SELECT 1 FROM historial_ttaip h
    WHERE h.id_expediente_ttaip = et.id_expediente_ttaip
      AND h.tipo_evento = 'SUBSANACION'
      AND h.referencia = rec.clave_operacion
);
