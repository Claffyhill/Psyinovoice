-- =========================================================
-- Migración 003 — Renombrar estados de citas
-- =========================================================
-- Reduce el enum de appointments.status de 5 a 4 valores:
--   pending, confirmed, completed, cancelled, no_show
--   -> scheduled, completed, cancelled, no_show
-- Las citas existentes en 'pending' o 'confirmed' pasan a 'scheduled'.
-- Ejecutar una sola vez, manualmente, contra la base de datos ya existente:
--   psql -d psyinvoice -f server/src/database/migrations/003_rename_status.sql
-- =========================================================

BEGIN;

-- 1. Migrar los datos existentes antes de endurecer el CHECK
UPDATE appointments SET status = 'scheduled' WHERE status IN ('pending', 'confirmed');

-- 2. Sustituir el CHECK constraint por el nuevo enum de 4 valores
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_status_check
    CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show'));

-- 3. Nuevo valor por defecto para citas creadas sin especificar estado
ALTER TABLE appointments ALTER COLUMN status SET DEFAULT 'scheduled';

COMMIT;
