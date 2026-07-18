-- =========================================================
-- PsyInvoice - Script de base de datos PostgreSQL
-- =========================================================
-- Ejecutar contra una base de datos vacía llamada "psyinvoice"
-- Los importes se almacenan en céntimos (INTEGER) para evitar
-- problemas de redondeo con decimales. Ej: 60,00 € -> 6000
-- =========================================================

DROP TABLE IF EXISTS invoices;
DROP TABLE IF EXISTS patients;
DROP TABLE IF EXISTS settings;

-- =========================================================
-- Tabla: patients
-- =========================================================
CREATE TABLE patients (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(100) NOT NULL,
    apellidos       VARCHAR(150) NOT NULL,
    dni             VARCHAR(15)  UNIQUE,
    telefono        VARCHAR(20),
    email           VARCHAR(150),
    direccion       VARCHAR(255),
    fecha_creacion  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_patients_nombre_apellidos ON patients (nombre, apellidos);

-- =========================================================
-- Tabla: settings
-- Datos del profesional y configuración de facturación.
-- Se espera una única fila (id = 1).
-- =========================================================
CREATE TABLE settings (
    id                       SERIAL PRIMARY KEY,
    nombre                   VARCHAR(100) NOT NULL DEFAULT '',
    apellidos                VARCHAR(150) NOT NULL DEFAULT '',
    nif                      VARCHAR(15)  NOT NULL DEFAULT '',
    direccion                VARCHAR(255) NOT NULL DEFAULT '',
    telefono                 VARCHAR(20)  NOT NULL DEFAULT '',
    email                    VARCHAR(150) NOT NULL DEFAULT '',
    numero_colegiada         VARCHAR(50)  NOT NULL DEFAULT '',
    precio_defecto_centimos  INTEGER      NOT NULL DEFAULT 6000,
    concepto_defecto         VARCHAR(255) NOT NULL DEFAULT 'Sesión de psicología sanitaria',
    prefijo_factura          VARCHAR(10)  NOT NULL DEFAULT 'FAC',
    siguiente_numero         INTEGER      NOT NULL DEFAULT 1
);

-- Fila única de configuración inicial (editar con los datos reales)
INSERT INTO settings (
    nombre, apellidos, nif, direccion, telefono, email,
    numero_colegiada, precio_defecto_centimos, concepto_defecto,
    prefijo_factura, siguiente_numero
) VALUES (
    'Nombre', 'Apellidos', '00000000A', 'Dirección fiscal', '600000000',
    'correo@ejemplo.com', 'M-00000', 6000, 'Sesión de psicología sanitaria',
    'FAC', 1
);

-- =========================================================
-- Tabla: invoices
-- =========================================================
CREATE TABLE invoices (
    id                  SERIAL PRIMARY KEY,
    numero_factura      VARCHAR(30) NOT NULL UNIQUE,
    fecha               DATE NOT NULL DEFAULT CURRENT_DATE,
    patient_id          INTEGER NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    concepto            VARCHAR(255) NOT NULL,
    importe_centimos    INTEGER NOT NULL CHECK (importe_centimos >= 0),
    tipo_iva            VARCHAR(20) NOT NULL DEFAULT 'exento' CHECK (tipo_iva IN ('exento', '21')),
    iva_centimos        INTEGER NOT NULL DEFAULT 0,
    total_centimos      INTEGER NOT NULL,
    estado              VARCHAR(20) NOT NULL DEFAULT 'pagada' CHECK (estado IN ('pendiente', 'pagada')),
    metodo_pago         VARCHAR(50),
    observaciones       TEXT,
    fecha_creacion      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoices_patient_id ON invoices (patient_id);
CREATE INDEX idx_invoices_fecha ON invoices (fecha);
CREATE INDEX idx_invoices_estado ON invoices (estado);

-- =========================================================
-- Fin del script
-- =========================================================
