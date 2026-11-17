// =========================================================
// PsyInvoice - Inicialización de la base de datos MongoDB
// =========================================================
// Sustituye a schema.sql y a las migraciones manuales de PostgreSQL.
// MongoDB no tiene DDL de tablas ni ALTER TABLE: este script crea los
// índices (incluidos los que hacían de UNIQUE constraint) y siembra los
// documentos iniciales. Es idempotente — se puede ejecutar varias veces
// sin duplicar datos ni fallar si los índices ya existen.
//
// Ejecutar una sola vez (o tras levantar una base de datos nueva):
//   node server/src/database/initMongo.js
//
// Los importes se siguen almacenando en céntimos (entero) para evitar
// problemas de redondeo con decimales. Ej: 60,00 € -> 6000
// =========================================================

import { connectDB, client } from '../config/database.js';
import path from 'node:path';

async function crearIndices(db) {
    // ---------- patients ----------
    await db.collection('patients').createIndex(
        { apellidos: 1, nombre: 1 }
    );
    await db.collection('patients').createIndex(
        { dni: 1 },
        { unique: true, sparse: true } // sparse: permite muchos documentos sin dni, igual que UNIQUE nullable en Postgres
    );

    // ---------- invoices ----------
    await db.collection('invoices').createIndex(
        { numero_factura: 1 },
        { unique: true }
    );
    await db.collection('invoices').createIndex({ patient_id: 1 });
    await db.collection('invoices').createIndex({ fecha: 1 });
    await db.collection('invoices').createIndex({ estado: 1 });
    // Equivalente al índice único PARCIAL de la migración 004: una única
    // factura mensual por paciente/año/mes, sin afectar a las facturas
    // individuales antiguas (billing_year/billing_month ausentes).
    await db.collection('invoices').createIndex(
        { patient_id: 1, billing_year: 1, billing_month: 1 },
        {
            unique: true,
            partialFilterExpression: {
                billing_year: { $type: 'int' },
                billing_month: { $type: 'int' }
            }
        }
    );

    // ---------- appointments ----------
    await db.collection('appointments').createIndex({ appointment_date: 1 });
    await db.collection('appointments').createIndex({ patient_id: 1 });
    await db.collection('appointments').createIndex({ status: 1 });
    await db.collection('appointments').createIndex({ patient_id: 1, appointment_date: 1 });
    // invoice_id: null / ausente = todavía no facturada (sustituye a la
    // tabla puente invoice_appointments; ver decisions-and-conventions)
    await db.collection('appointments').createIndex({ invoice_id: 1 });
    // Mismo UNIQUE(appointment_date, start_time) que tenía Postgres
    await db.collection('appointments').createIndex(
        { appointment_date: 1, start_time: 1 },
        { unique: true }
    );

    // ---------- weekly_availability / availability_blocks ----------
    await db.collection('weekly_availability').createIndex({ day_of_week: 1 });
    await db.collection('availability_blocks').createIndex({ block_date: 1 });

    console.log('Índices creados/verificados.');
}

async function sembrarSettings(db) {
    const existente = await db.collection('settings').findOne({});
    if (existente) {
        console.log('La configuración inicial ya existe, no se siembra de nuevo.');
        return;
    }

    await db.collection('settings').insertOne({
        nombre: 'Nombre',
        apellidos: 'Apellidos',
        nif: '00000000A',
        direccion: 'Dirección fiscal',
        telefono: '600000000',
        email: 'correo@ejemplo.com',
        numero_colegiada: 'M-00000',
        precio_defecto_centimos: 6000,
        concepto_defecto: 'Sesión de psicología sanitaria',
        prefijo_factura: 'FAC',
        siguiente_numero: 1
    });
    console.log('Documento de configuración inicial sembrado (edítalo con los datos reales).');
}

async function sembrarHorarioSemanal(db) {
    const yaHayHorario = await db.collection('weekly_availability').countDocuments({});
    if (yaHayHorario > 0) {
        console.log('Ya existe horario semanal, no se siembra de nuevo.');
        return;
    }

    // Horario por defecto (lunes a viernes): mañana, tarde y los dos
    // huecos extra de 45 min añadidos originalmente en la migración 005.
    const dias = [1, 2, 3, 4, 5];
    const ventanas = dias.flatMap((dia) => ([
        { day_of_week: dia, start_time: '09:15', end_time: '13:45', active: true },
        { day_of_week: dia, start_time: '13:45', end_time: '14:30', active: true },
        { day_of_week: dia, start_time: '16:00', end_time: '19:00', active: true },
        { day_of_week: dia, start_time: '20:45', end_time: '21:30', active: true }
    ]));

    await db.collection('weekly_availability').insertMany(ventanas);
    console.log('Horario semanal por defecto sembrado.');
}

//* Inicialización reutilizable desde Electron.
export async function initializeDatabase(db = null) {
    // Si Electron ya ha conectado MongoDB, reutilizamos esa conexión.
    // Si se ejecuta desde terminal, creamos la conexión aquí.
    const database = db ?? await connectDB();

    await crearIndices(database);
    await sembrarSettings(database);
    await sembrarHorarioSemanal(database);

    console.log('Inicialización completada.');
}

// Ejecución independiente desde la terminal.
async function main() {
    try {
        await initializeDatabase();
    } finally {
        await client.close();
    }
}

if (
    process.argv[1] &&
    import.meta.url === new URL(
        `file://${path.resolve(process.argv[1]).replace(/\\/g, '/')}`
    ).href
) {
    main().catch((err) => {
        console.error('Error inicializando la base de datos:', err);
        process.exitCode = 1;
    });
}
