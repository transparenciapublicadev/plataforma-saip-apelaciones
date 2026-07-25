-- =============================================================================
-- Migration V3: Add Persona Juridica and Structured Legal Address columns
-- =============================================================================

ALTER TABLE ciudadanos
  ADD COLUMN IF NOT EXISTS tipo_persona VARCHAR(20) DEFAULT 'NATURAL',
  ADD COLUMN IF NOT EXISTS nombres VARCHAR(100),
  ADD COLUMN IF NOT EXISTS apellido_paterno VARCHAR(100),
  ADD COLUMN IF NOT EXISTS apellido_materno VARCHAR(100),
  ADD COLUMN IF NOT EXISTS ruc VARCHAR(11),
  ADD COLUMN IF NOT EXISTS razon_social VARCHAR(200),
  ADD COLUMN IF NOT EXISTS representante_dni VARCHAR(15),
  ADD COLUMN IF NOT EXISTS representante_nombre_completo VARCHAR(200),
  ADD COLUMN IF NOT EXISTS ubigeo VARCHAR(6),
  ADD COLUMN IF NOT EXISTS departamento VARCHAR(100),
  ADD COLUMN IF NOT EXISTS provincia VARCHAR(100),
  ADD COLUMN IF NOT EXISTS distrito VARCHAR(100),
  ADD COLUMN IF NOT EXISTS tipo_via VARCHAR(50),
  ADD COLUMN IF NOT EXISTS nombre_via VARCHAR(150),
  ADD COLUMN IF NOT EXISTS numero VARCHAR(20),
  ADD COLUMN IF NOT EXISTS interior VARCHAR(20),
  ADD COLUMN IF NOT EXISTS referencia VARCHAR(200);

-- Allow DNI to be NULL for Persona Jurídica accounts using RUC
ALTER TABLE ciudadanos ALTER COLUMN dni DROP NOT NULL;
