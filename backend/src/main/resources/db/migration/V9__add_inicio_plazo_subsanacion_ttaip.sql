-- No historical backfill: creation/sending/validation timestamps are not proof of efficacy.
CREATE TABLE inicios_plazo_subsanacion_ttaip (
    id_requerimiento BIGINT PRIMARY KEY REFERENCES resoluciones(id_resolucion),
    id_notificacion BIGINT NOT NULL REFERENCES notificaciones_ttaip(id_notificacion),
    id_ciudadano BIGINT NOT NULL REFERENCES usuarios(id_usuario),
    fecha_eficacia TIMESTAMP NOT NULL,
    dias_habiles INTEGER NOT NULL,
    fuente VARCHAR(40) NOT NULL,
    sustento TEXT NOT NULL,
    fecha_registro TIMESTAMP NOT NULL
);
