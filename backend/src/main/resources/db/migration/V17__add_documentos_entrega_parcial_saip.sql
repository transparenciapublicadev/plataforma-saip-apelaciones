ALTER TABLE documentos
    ADD COLUMN id_entrega_parcial BIGINT REFERENCES cronograma_entregas_parciales_solicitud (id_entrega),
    ADD CONSTRAINT chk_documento_relacion_entrega_parcial CHECK (
        id_entrega_parcial IS NULL OR num_nonnulls(id_solicitud, id_respuesta, id_apelacion,
            id_resolucion, id_expediente_ttaip, id_cedula) = 0
    );

CREATE INDEX idx_documentos_entrega_parcial ON documentos (id_entrega_parcial);

ALTER TABLE cronograma_entregas_parciales_solicitud
    ADD COLUMN decision VARCHAR(30),
    ADD COLUMN fundamento_decision TEXT,
    ADD CONSTRAINT chk_entrega_parcial_decision CHECK (
        decision IS NULL OR decision = 'ENTREGA_TOTAL' OR (
            decision IN ('ENTREGA_PARCIAL', 'DENEGACION_TOTAL')
            AND NULLIF(BTRIM(fundamento_decision), '') IS NOT NULL
        )
    );
