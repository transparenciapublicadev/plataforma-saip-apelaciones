-- Additive durable receipts; existing mobile/JSON contracts are unaffected.
-- Application rollback may leave this table in place. Never delete accepted receipts.
CREATE TABLE recepciones_precision_saip (
    id_recepcion BIGSERIAL PRIMARY KEY,
    id_observacion BIGINT NOT NULL,
    id_documento BIGINT NOT NULL,
    id_creado_por BIGINT NOT NULL,
    clave_operacion VARCHAR(36) NOT NULL,
    huella_solicitud VARCHAR(64) NOT NULL,
    fecha_recepcion TIMESTAMP NOT NULL,
    comentario TEXT NOT NULL,
    CONSTRAINT uk_precision_observacion UNIQUE (id_observacion),
    CONSTRAINT uk_precision_operacion UNIQUE (clave_operacion),
    CONSTRAINT uk_precision_documento UNIQUE (id_documento),
    CONSTRAINT fk_precision_observacion FOREIGN KEY (id_observacion)
        REFERENCES observaciones_solicitud (id_observacion),
    CONSTRAINT fk_precision_documento FOREIGN KEY (id_documento)
        REFERENCES documentos (id_documento),
    CONSTRAINT fk_precision_usuario FOREIGN KEY (id_creado_por)
        REFERENCES usuarios (id_usuario)
);
