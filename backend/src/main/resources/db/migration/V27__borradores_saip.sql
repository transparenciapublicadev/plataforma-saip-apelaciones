-- Preparación de una SAIP que todavía no se presenta.
-- No abre expediente, no inicia plazo y solo la ve quien la está escribiendo.

CREATE TABLE borradores_saip (
    id_borrador BIGSERIAL PRIMARY KEY,
    id_ciudadano BIGINT NOT NULL REFERENCES ciudadanos (id_usuario),
    id_entidad BIGINT REFERENCES entidades (id_entidad),
    asunto VARCHAR(500),
    descripcion TEXT,
    tipo_informacion VARCHAR(100),
    oficina_destinataria VARCHAR(160),
    formato_correo BOOLEAN NOT NULL DEFAULT FALSE,
    copia_simple BOOLEAN NOT NULL DEFAULT FALSE,
    copia_certificada BOOLEAN NOT NULL DEFAULT FALSE,
    soporte_magnetico BOOLEAN NOT NULL DEFAULT FALSE,
    canal_notificacion VARCHAR(20),
    acepta_canal BOOLEAN NOT NULL DEFAULT FALSE,
    consentimiento_datos BOOLEAN NOT NULL DEFAULT FALSE,
    declara_veracidad BOOLEAN NOT NULL DEFAULT FALSE,
    paso SMALLINT NOT NULL DEFAULT 1,
    creado TIMESTAMP NOT NULL,
    actualizado TIMESTAMP NOT NULL
);

CREATE INDEX idx_borrador_saip_ciudadano ON borradores_saip (id_ciudadano, actualizado DESC);
