-- =========================================================
-- Migración 004 — Facturación mensual agrupada
-- =========================================================
-- No modifica datos existentes ni migraciones anteriores.
-- Ejecutar una sola vez, manualmente, contra la base de datos ya existente:
--   psql -d psyinvoice -f server/src/database/migrations/004_monthly_invoicing.sql
-- =========================================================

BEGIN;

-- ---------------------------------------------------------
-- Una única factura por paciente, año y mes de facturación.
-- Es un índice único PARCIAL (solo aplica cuando billing_year/
-- billing_month están informados) para no afectar a las facturas
-- individuales antiguas, que dejan esos campos en NULL.
-- ---------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_patient_billing_period
    ON invoices (patient_id, billing_year, billing_month)
    WHERE billing_year IS NOT NULL AND billing_month IS NOT NULL;

-- ---------------------------------------------------------
-- Índices de apoyo para las consultas de facturación mensual
-- ---------------------------------------------------------

-- Buscar rápidamente las citas vinculadas a una factura
CREATE INDEX IF NOT EXISTS idx_invoice_appointments_invoice_id
    ON invoice_appointments (invoice_id);

-- Agrupar/filtrar citas de un paciente por fecha (resumen mensual)
CREATE INDEX IF NOT EXISTS idx_appointments_patient_date
    ON appointments (patient_id, appointment_date);

COMMIT;
