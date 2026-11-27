ALTER TABLE cumplimientos_resolucion_ttaip
    ADD COLUMN id_notificacion_inicio BIGINT REFERENCES notificaciones_ttaip (id_notificacion),
    ADD COLUMN operacion_entrega UUID,
    ADD COLUMN fecha_entrega TIMESTAMP,
    ADD COLUMN id_actor_entrega BIGINT REFERENCES usuarios (id_usuario),
    ADD COLUMN operacion_validacion_entrega UUID,
    ADD COLUMN fecha_eficacia_entrega DATE,
    ADD COLUMN fecha_validacion_entrega TIMESTAMP,
    ADD COLUMN id_actor_validacion BIGINT REFERENCES usuarios (id_usuario),
    ADD COLUMN operacion_remision UUID,
    ADD COLUMN numero_oficio VARCHAR(120),
    ADD COLUMN id_actor_remision BIGINT REFERENCES usuarios (id_usuario);

CREATE UNIQUE INDEX uq_cumplimiento_documental_resolucion
    ON cumplimientos_resolucion_ttaip (id_resolucion) WHERE id_notificacion_inicio IS NOT NULL;

ALTER TABLE documentos
    ADD COLUMN id_cumplimiento BIGINT REFERENCES cumplimientos_resolucion_ttaip (id_cumplimiento),
    ADD COLUMN clase_adjunto_cumplimiento VARCHAR(24),
    ADD CONSTRAINT ck_documento_cumplimiento CHECK (
        (id_cumplimiento IS NULL AND clase_adjunto_cumplimiento IS NULL)
        OR (id_cumplimiento IS NOT NULL AND clase_adjunto_cumplimiento IS NOT NULL
            AND clase_adjunto_cumplimiento IN ('RESPUESTA', 'ANEXO_RESPUESTA', 'CARGO', 'ACUSE', 'OFICIO', 'ANEXO_OFICIO'))
    );

CREATE INDEX idx_documentos_cumplimiento ON documentos (id_cumplimiento)
    WHERE id_cumplimiento IS NOT NULL;
