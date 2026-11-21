-- El encauzamiento total abre un expediente nuevo en la entidad de destino.
-- El expediente de origen conserva el historial hasta ese acto.

ALTER TABLE encauzamientos_solicitud
    ADD COLUMN id_solicitud_derivada BIGINT;

ALTER TABLE encauzamientos_solicitud
    ADD CONSTRAINT fk_enc_solicitud_derivada
    FOREIGN KEY (id_solicitud_derivada) REFERENCES solicitudes (id_solicitud);

ALTER TABLE encauzamientos_solicitud
    ADD CONSTRAINT uk_enc_solicitud_derivada UNIQUE (id_solicitud_derivada);
