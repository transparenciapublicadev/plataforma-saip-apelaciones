-- Una ampliación vigente ya no está solo recepcionada: la entidad atiende por partes.
UPDATE solicitudes s
SET estado = 'EN_REVISION'
WHERE s.estado = 'RECEPCIONADA'
  AND EXISTS (
      SELECT 1
      FROM ampliaciones_plazo_solicitud a
      WHERE a.id_solicitud = s.id_solicitud
        AND a.estado_ampliacion <> 'CANCELADA'
  );
