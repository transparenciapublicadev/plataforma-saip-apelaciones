-- Forward-only, additive reception and immutable accepted provenance; no historical reconstruction.
CREATE TABLE recepciones_alta_apelacion (
    id_recepcion BIGSERIAL PRIMARY KEY,
    id_apelacion BIGINT NOT NULL UNIQUE REFERENCES apelaciones(id_apelacion),
    id_creado_por BIGINT NOT NULL REFERENCES usuarios(id_usuario),
    clave_operacion VARCHAR(36) NOT NULL UNIQUE,
    huella_solicitud VARCHAR(90) NOT NULL,
    modalidad VARCHAR(24) NOT NULL,
    fecha_recepcion TIMESTAMP NOT NULL
);
CREATE TABLE recepcion_alta_apelacion_documentos (
    id_recepcion BIGINT NOT NULL REFERENCES recepciones_alta_apelacion(id_recepcion) ON DELETE CASCADE,
    orden INTEGER NOT NULL,
    id_documento BIGINT NOT NULL UNIQUE REFERENCES documentos(id_documento),
    id_documento_origen BIGINT REFERENCES documentos(id_documento),
    hash_aceptado VARCHAR(64) NOT NULL,
    PRIMARY KEY (id_recepcion, orden)
);
