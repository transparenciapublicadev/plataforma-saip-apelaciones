-- Institutional drafts only. No formal issuance, delivery or notification is represented.
CREATE TABLE reportes_institucionales_borradores (
    id UUID PRIMARY KEY,
    ambito VARCHAR(80) NOT NULL,
    modo VARCHAR(10) NOT NULL CHECK (modo IN ('entidad', 'ttaip')),
    desde DATE NOT NULL,
    hasta DATE NOT NULL,
    version BIGINT NOT NULL CHECK (version >= 0),
    operacion_id UUID NOT NULL,
    cualitativo TEXT NOT NULL,
    resumen TEXT NOT NULL,
    actualizado TIMESTAMP NOT NULL,
    id_autor BIGINT NOT NULL REFERENCES usuarios(id_usuario),
    CONSTRAINT uq_reporte_borrador_periodo UNIQUE (ambito, desde, hasta),
    CONSTRAINT ck_reporte_periodo CHECK (hasta >= desde)
);
CREATE INDEX idx_reporte_borrador_ambito ON reportes_institucionales_borradores (ambito, actualizado DESC, id);
