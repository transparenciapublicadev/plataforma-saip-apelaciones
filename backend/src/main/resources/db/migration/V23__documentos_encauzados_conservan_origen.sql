-- Los archivos que el administrado presentó ante la entidad de origen
-- se incorporan al expediente nuevo y conservan esa procedencia.

ALTER TABLE documentos
    ADD COLUMN expediente_origen VARCHAR(40);

ALTER TABLE documentos
    ADD COLUMN entidad_origen VARCHAR(200);
