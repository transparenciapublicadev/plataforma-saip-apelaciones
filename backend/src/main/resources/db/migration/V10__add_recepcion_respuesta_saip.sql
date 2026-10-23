-- Additive reception/manifest; V1-V9 and legacy response APIs remain unchanged.
-- Rollback of application code leaves accepted receipts in place (forward-only).
CREATE TABLE recepciones_respuesta_saip (
    id_recepcion BIGSERIAL PRIMARY KEY,
    id_solicitud BIGINT NOT NULL REFERENCES solicitudes(id_solicitud),
    id_respuesta BIGINT NOT NULL REFERENCES respuestas(id_respuesta),
    id_creado_por BIGINT NOT NULL REFERENCES usuarios(id_usuario),
    clave_operacion VARCHAR(36) NOT NULL,
    huella_solicitud VARCHAR(64) NOT NULL,
    fecha_recepcion TIMESTAMP NOT NULL,
    CONSTRAINT uk_recepcion_respuesta_solicitud UNIQUE (id_solicitud),
    CONSTRAINT uk_recepcion_respuesta UNIQUE (id_respuesta),
    CONSTRAINT uk_recepcion_respuesta_actor_clave UNIQUE (id_creado_por, clave_operacion)
);

CREATE TABLE recepcion_respuesta_saip_documentos (
    id_recepcion BIGINT NOT NULL REFERENCES recepciones_respuesta_saip(id_recepcion) ON DELETE CASCADE,
    orden INTEGER NOT NULL,
    id_documento BIGINT NOT NULL REFERENCES documentos(id_documento),
    PRIMARY KEY (id_recepcion, orden),
    CONSTRAINT uk_recepcion_respuesta_documento UNIQUE (id_documento)
);
