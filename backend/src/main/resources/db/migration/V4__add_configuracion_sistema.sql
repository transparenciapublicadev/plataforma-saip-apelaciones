-- =============================================================================
-- Migration V4: Add configuracion_sistema table and default system configuration
-- =============================================================================

CREATE TABLE IF NOT EXISTS configuracion_sistema (
    id BIGINT PRIMARY KEY,
    plazo_saip_respuesta INT NOT NULL DEFAULT 10,
    plazo_saip_prorroga INT NOT NULL DEFAULT 7,
    plazo_subsanacion INT NOT NULL DEFAULT 2,
    plazo_recojo_informacion INT NOT NULL DEFAULT 5,
    plazo_apelacion_interposicion INT NOT NULL DEFAULT 15,
    plazo_ttaip_resolucion INT NOT NULL DEFAULT 10,
    plazo_ttaip_calificacion INT NOT NULL DEFAULT 3,
    plazo_ttaip_subsanacion INT NOT NULL DEFAULT 2,
    notif_vencidas BOOLEAN NOT NULL DEFAULT TRUE,
    notif_proximos BOOLEAN NOT NULL DEFAULT TRUE,
    notif_registros BOOLEAN NOT NULL DEFAULT FALSE,
    notif_umbral_proximo INT NOT NULL DEFAULT 2,
    costo_por_copia NUMERIC(10,2) NOT NULL DEFAULT 0.10
);

INSERT INTO configuracion_sistema (
    id, plazo_saip_respuesta, plazo_saip_prorroga, plazo_subsanacion, plazo_recojo_informacion,
    plazo_apelacion_interposicion, plazo_ttaip_resolucion, plazo_ttaip_calificacion, plazo_ttaip_subsanacion,
    notif_vencidas, notif_proximos, notif_registros, notif_umbral_proximo, costo_por_copia
) VALUES (
    1, 10, 7, 2, 5, 15, 10, 3, 2, TRUE, TRUE, FALSE, 2, 0.10
) ON CONFLICT (id) DO NOTHING;
