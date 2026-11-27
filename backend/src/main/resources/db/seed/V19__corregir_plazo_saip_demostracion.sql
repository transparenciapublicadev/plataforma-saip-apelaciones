-- Corrige el vencimiento de las SAIP de demostración.
-- V2 dejó la fecha límite a unos días de calendario. El plazo ordinario es de 10 días hábiles
-- contados desde el día siguiente a la presentación, con el mismo calendario que DiasHabilesUtil.
-- No editar V2: esta corrección es idempotente y solo corre donde se carga la semilla.

CREATE OR REPLACE FUNCTION seed_saip_domingo_pascua(y integer) RETURNS date
LANGUAGE plpgsql AS $$
DECLARE
    a integer; b integer; c integer; d integer; e integer; f integer; g integer;
    h integer; i integer; k integer; l integer; m integer; mes integer; dia integer;
BEGIN
    a := y % 19; b := y / 100; c := y % 100; d := b / 4; e := b % 4;
    f := (b + 8) / 25; g := (b - f + 1) / 3;
    h := (19 * a + b - d - g + 15) % 30; i := c / 4; k := c % 4;
    l := (32 + 2 * e + 2 * i - h - k) % 7; m := (a + 11 * h + 22 * l) / 451;
    mes := (h + l - 7 * m + 114) / 31;
    dia := ((h + l - 7 * m + 114) % 31) + 1;
    RETURN make_date(y, mes, dia);
END $$;

CREATE OR REPLACE FUNCTION seed_saip_es_inhabil(fecha date) RETURNS boolean
LANGUAGE plpgsql AS $$
DECLARE
    mmdd text;
    pascua date;
BEGIN
    IF EXTRACT(ISODOW FROM fecha) IN (6, 7) THEN
        RETURN true;
    END IF;
    mmdd := to_char(fecha, 'MM-DD');
    IF mmdd IN ('01-01', '05-01', '06-07', '06-29', '07-23', '07-28', '07-29',
                '08-06', '08-30', '10-08', '11-01', '12-08', '12-09', '12-25') THEN
        RETURN true;
    END IF;
    IF fecha IN (DATE '2026-01-02', DATE '2026-07-27') THEN
        RETURN true;
    END IF;
    pascua := seed_saip_domingo_pascua(EXTRACT(YEAR FROM fecha)::integer);
    RETURN fecha IN (pascua - 3, pascua - 2);
END $$;

CREATE OR REPLACE FUNCTION seed_saip_sumar_dias_habiles(inicio date, cantidad integer) RETURNS date
LANGUAGE plpgsql AS $$
DECLARE
    fecha date := inicio;
    contador integer := 0;
BEGIN
    WHILE contador < cantidad LOOP
        fecha := fecha + 1;
        IF NOT seed_saip_es_inhabil(fecha) THEN
            contador := contador + 1;
        END IF;
    END LOOP;
    RETURN fecha;
END $$;

UPDATE solicitudes
SET fecha_limite = seed_saip_sumar_dias_habiles((fecha_presentacion AT TIME ZONE 'America/Lima')::date, 10)
WHERE expediente IN (
    'SAIP-2026-10001',
    'SAIP-2026-10002',
    'SAIP-2026-10003',
    'SAIP-2026-10004',
    'SAIP-2026-10005'
);

DROP FUNCTION seed_saip_sumar_dias_habiles(date, integer);
DROP FUNCTION seed_saip_es_inhabil(date);
DROP FUNCTION seed_saip_domingo_pascua(integer);
