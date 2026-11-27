-- Additive operation identity and exact manifest; existing SAIP records are not reconstructed.
-- Forward-only: reverting application code leaves confirmed receipts intact.
CREATE TABLE recepciones_alta_saip (
    id_recepcion BIGSERIAL PRIMARY KEY,
    id_solicitud BIGINT NOT NULL REFERENCES solicitudes(id_solicitud),
    id_creado_por BIGINT NOT NULL REFERENCES usuarios(id_usuario),
    clave_operacion VARCHAR(36) NOT NULL,
    huella_solicitud VARCHAR(80) NOT NULL,
    fecha_recepcion TIMESTAMP NOT NULL,
    declara_veracidad BOOLEAN NOT NULL CHECK (declara_veracidad = true),
    CONSTRAINT uk_recepcion_alta_solicitud UNIQUE (id_solicitud),
    CONSTRAINT uk_recepcion_alta_clave UNIQUE (clave_operacion)
);
CREATE TABLE recepcion_alta_saip_documentos (
    id_recepcion BIGINT NOT NULL REFERENCES recepciones_alta_saip(id_recepcion) ON DELETE CASCADE,
    orden INTEGER NOT NULL,
    id_documento BIGINT NOT NULL REFERENCES documentos(id_documento),
    PRIMARY KEY (id_recepcion, orden),
    CONSTRAINT uk_recepcion_alta_documento UNIQUE (id_documento)
);
