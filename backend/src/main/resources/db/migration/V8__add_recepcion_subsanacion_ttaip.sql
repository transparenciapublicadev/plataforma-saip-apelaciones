-- Additive; accepted receipts must be retained when rolling back application code.
-- Cardinality is one receipt per concrete resolution requirement, never per appeal.
CREATE TABLE recepciones_subsanacion_ttaip (
    id_recepcion BIGSERIAL PRIMARY KEY,
    id_requerimiento BIGINT NOT NULL REFERENCES resoluciones(id_resolucion),
    id_creado_por BIGINT NOT NULL REFERENCES usuarios(id_usuario),
    clave_operacion VARCHAR(36) NOT NULL,
    huella_solicitud VARCHAR(64) NOT NULL,
    fecha_recepcion TIMESTAMP NOT NULL,
    fundamentos TEXT NOT NULL,
    CONSTRAINT uk_subsanacion_ttaip_requerimiento UNIQUE (id_requerimiento),
    CONSTRAINT uk_subsanacion_ttaip_operacion UNIQUE (clave_operacion)
);
CREATE TABLE recepcion_subsanacion_ttaip_documentos (
    id_recepcion BIGINT NOT NULL REFERENCES recepciones_subsanacion_ttaip(id_recepcion),
    id_documento BIGINT NOT NULL REFERENCES documentos(id_documento),
    posicion INTEGER NOT NULL,
    PRIMARY KEY (id_recepcion, posicion),
    CONSTRAINT uk_subsanacion_ttaip_documento UNIQUE (id_documento)
);
