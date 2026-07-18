-- =========================================================
-- Migración 002 — Calendario y disponibilidad
-- =========================================================
-- No modifica ni sustituye schema.sql. Ejecutar una sola vez,
-- manualmente, contra la base de datos ya existente:
--   psql -d psyinvoice -f server/src/database/migrations/002_appointments.sql
-- =========================================================

-- ---------------------------------------------------------
-- Disponibilidad semanal (plantilla de horario recurrente)
-- day_of_week: 0 = domingo ... 6 = sábado (igual que Date.getDay() en JS)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS weekly_availability (
    id          SERIAL PRIMARY KEY,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time  TIME NOT NULL,
    end_time    TIME NOT NULL,
    active      BOOLEAN NOT NULL DEFAULT true,
    CHECK (end_time > start_time)
);

-- ---------------------------------------------------------
-- Bloqueos puntuales (vacaciones, festivos, imprevistos)
-- Si start_time/end_time son NULL, bloquea el día completo.
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS availability_blocks (
    id          SERIAL PRIMARY KEY,
    block_date  DATE NOT NULL,
    start_time  TIME,
    end_time    TIME,
    reason      VARCHAR(255),
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_availability_blocks_date ON availability_blocks (block_date);

-- ---------------------------------------------------------
-- Citas
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS appointments (
    id                   SERIAL PRIMARY KEY,
    patient_id           INTEGER NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    appointment_date     DATE NOT NULL,
    start_time           TIME NOT NULL,
    end_time             TIME NOT NULL,
    status               VARCHAR(20) NOT NULL DEFAULT 'confirmed'
                         CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
    amount_cents         INTEGER NOT NULL CHECK (amount_cents > 0),
    booking_source       VARCHAR(20) NOT NULL DEFAULT 'admin',
    administrative_notes TEXT,
    created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (appointment_date, start_time)
);

CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments (appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments (patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments (status);

-- ---------------------------------------------------------
-- Relación entre facturas y las citas que agrupan
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoice_appointments (
    id             SERIAL PRIMARY KEY,
    invoice_id     INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE RESTRICT,
    UNIQUE (appointment_id)
);

-- ---------------------------------------------------------
-- Campos nuevos en invoices para la futura facturación mensual agrupada
-- ---------------------------------------------------------
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS billing_year INTEGER;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS billing_month INTEGER CHECK (billing_month BETWEEN 1 AND 12);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS session_count INTEGER;

-- ---------------------------------------------------------
-- Horario por defecto solicitado (lunes a viernes, mañana y tarde)
-- Puedes editarlo o ampliarlo después vía SQL o vía la futura pantalla de configuración.
-- ---------------------------------------------------------
INSERT INTO weekly_availability (day_of_week, start_time, end_time, active)
SELECT dia, hora_inicio, hora_fin, true
FROM (VALUES
    (1, '09:15'::time, '13:45'::time),
    (1, '16:00'::time, '19:00'::time),
    (2, '09:15'::time, '13:45'::time),
    (2, '16:00'::time, '19:00'::time),
    (3, '09:15'::time, '13:45'::time),
    (3, '16:00'::time, '19:00'::time),
    (4, '09:15'::time, '13:45'::time),
    (4, '16:00'::time, '19:00'::time),
    (5, '09:15'::time, '13:45'::time),
    (5, '16:00'::time, '19:00'::time)
) AS defecto(dia, hora_inicio, hora_fin)
WHERE NOT EXISTS (SELECT 1 FROM weekly_availability);
