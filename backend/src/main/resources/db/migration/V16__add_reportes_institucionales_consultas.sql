-- Latest consultation of an institutional report period. Not an issuance, delivery or notification.
CREATE TABLE reportes_institucionales_consultas (
    id UUID PRIMARY KEY,
    ambito VARCHAR(80) NOT NULL,
    modo VARCHAR(10) NOT NULL CHECK (modo IN ('entidad', 'ttaip')),
    desde DATE NOT NULL,
    hasta DATE NOT NULL,
    consultado TIMESTAMP NOT NULL,
    id_autor BIGINT NOT NULL REFERENCES usuarios(id_usuario),
    total BIGINT NOT NULL,
    con_actuacion BIGINT NOT NULL,
    en_plazo_legal BIGINT,
    tiempo_promedio_dias NUMERIC(8, 1),
    CONSTRAINT uq_reporte_consulta_periodo UNIQUE (ambito, desde, hasta),
    CONSTRAINT ck_reporte_consulta_periodo CHECK (hasta >= desde)
);
CREATE INDEX idx_reporte_consulta_ambito ON reportes_institucionales_consultas (ambito, consultado DESC, id);
