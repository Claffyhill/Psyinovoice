import { ObjectId } from 'mongodb';
import { getDb, withTransaction } from '../config/database.js';
import { toObjectId } from '../utils/mongoId.js';
import { formatInvoiceNumber } from '../utils/invoiceNumber.js';
import * as settingsRepository from './settingsRepository.js';
import * as appointmentsRepository from './appointmentsRepository.js';

function coleccion() {
    return getDb().collection('invoices');
}

const LOOKUP_PACIENTE = [
    {
        $lookup: {
            from: 'patients',
            localField: 'patient_id',
            foreignField: '_id',
            as: 'paciente'
        }
    },
    { $unwind: '$paciente' }
];

function toDto(doc) {
    if (!doc) return null;
    return {
        id: doc._id.toString(),
        numero_factura: doc.numero_factura,
        fecha: doc.fecha,
        patient_id: doc.patient_id.toString(),
        paciente_nombre: doc.paciente.nombre,
        paciente_apellidos: doc.paciente.apellidos,
        concepto: doc.concepto,
        importe_centimos: doc.importe_centimos,
        tipo_iva: doc.tipo_iva,
        iva_centimos: doc.iva_centimos,
        total_centimos: doc.total_centimos,
        estado: doc.estado,
        metodo_pago: doc.metodo_pago,
        observaciones: doc.observaciones,
        fecha_creacion: doc.fecha_creacion
    };
}

function toDtoParaPdf(doc) {
    if (!doc) return null;
    return {
        id: doc._id.toString(),
        numero_factura: doc.numero_factura,
        fecha: doc.fecha,
        concepto: doc.concepto,
        importe_centimos: doc.importe_centimos,
        tipo_iva: doc.tipo_iva,
        iva_centimos: doc.iva_centimos,
        total_centimos: doc.total_centimos,
        estado: doc.estado,
        metodo_pago: doc.metodo_pago,
        observaciones: doc.observaciones,
        paciente_nombre: doc.paciente.nombre,
        paciente_apellidos: doc.paciente.apellidos,
        paciente_dni: doc.paciente.dni,
        paciente_direccion: doc.paciente.direccion,
        paciente_email: doc.paciente.email
    };
}

export async function findAll(filters) {
    const match = {};
    const matchPaciente = {};

    if (filters.search) {
        const regex = new RegExp(filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        match.$or = [
            { numero_factura: regex },
            { 'paciente.nombre': regex },
            { 'paciente.apellidos': regex }
        ];
    }
    if (filters.status) match.estado = filters.status;
    if (filters.year) match.fecha = { $regex: `^${String(filters.year).padStart(4, '0')}-` };
    if (filters.quarter) {
        const meses = {
            1: ['01', '02', '03'], 2: ['04', '05', '06'],
            3: ['07', '08', '09'], 4: ['10', '11', '12']
        }[Number(filters.quarter)] || [];
        match.$expr = { $in: [{ $substrCP: ['$fecha', 5, 2] }, meses] };
    }

    const docs = await coleccion().aggregate([
        ...LOOKUP_PACIENTE,
        { $match: match },
        { $sort: { fecha: -1, _id: -1 } }
    ]).toArray();

    return docs.map(toDto);
}

export async function findById(id) {
    const _id = toObjectId(id);
    if (!_id) return null;

    const [doc] = await coleccion().aggregate([
        { $match: { _id } },
        ...LOOKUP_PACIENTE
    ]).toArray();

    return toDto(doc);
}

export async function findByIdForPdf(id) {
    const _id = toObjectId(id);
    if (!_id) return null;

    const [doc] = await coleccion().aggregate([
        { $match: { _id } },
        ...LOOKUP_PACIENTE
    ]).toArray();

    return toDtoParaPdf(doc);
}

export async function findByQuarterForPdf(year, quarter) {
    const meses = {
        1: ['01', '02', '03'], 2: ['04', '05', '06'],
        3: ['07', '08', '09'], 4: ['10', '11', '12']
    }[Number(quarter)] || [];

    const docs = await coleccion().aggregate([
        {
            $match: {
                fecha: { $regex: `^${String(year).padStart(4, '0')}-` },
                $expr: { $in: [{ $substrCP: ['$fecha', 5, 2] }, meses] }
            }
        },
        ...LOOKUP_PACIENTE,
        { $sort: { fecha: 1, _id: 1 } }
    ]).toArray();

    return docs.map(toDtoParaPdf);
}

/**
 * Crea una factura asignando el número de forma atómica: dentro de una
 * transacción multi-documento, calcula el número a partir de settings,
 * inserta la factura e incrementa el contador. Sustituye al
 * BEGIN + SELECT ... FOR UPDATE + COMMIT de Postgres: en Mongo la
 * atomicidad la da la transacción (si dos peticiones concurrentes leen el
 * mismo `siguiente_numero`, la segunda en escribir aborta con un conflicto
 * de escritura y se reintenta automáticamente).
 */
export async function create(invoice) {
    const invoiceId = await withTransaction(async (session) => {
        const settings = await settingsRepository.getSettings(session);

        const anio = new Date(invoice.fecha).getFullYear();
        const numeroFactura = formatInvoiceNumber(
            settings.prefijo_factura,
            settings.siguiente_numero,
            anio
        );

        const doc = {
            numero_factura: numeroFactura,
            fecha: invoice.fecha,
            patient_id: new ObjectId(invoice.patient_id),
            concepto: invoice.concepto,
            importe_centimos: invoice.importe_centimos,
            tipo_iva: invoice.tipo_iva,
            iva_centimos: invoice.iva_centimos,
            total_centimos: invoice.total_centimos,
            estado: invoice.estado,
            metodo_pago: invoice.metodo_pago || null,
            observaciones: invoice.observaciones || null,
            fecha_creacion: new Date(),
            billing_year: null,
            billing_month: null,
            session_count: null
        };

        const { insertedId } = await coleccion().insertOne(doc, { session });

        await settingsRepository.incrementInvoiceNumber(session, settings.id);

        return insertedId;
    });

    return findById(invoiceId);
}

export async function updateStatus(id, estado) {
    const _id = toObjectId(id);
    if (!_id) return null;

    const resultado = await coleccion().updateOne({ _id }, { $set: { estado } });
    if (resultado.matchedCount === 0) return null;

    return findById(id);
}

/**
 * Busca si ya existe una factura mensual para ese paciente/año/mes.
 * Se usa para dar un mensaje de error claro ANTES de intentar el INSERT
 * (el índice único parcial de initMongo.js actúa como red de seguridad
 * final ante condiciones de carrera).
 */
export async function findByPatientAndBillingPeriod(patientId, year, month) {
    const _patientId = toObjectId(patientId);
    if (!_patientId) return null;

    const doc = await coleccion().findOne({
        patient_id: _patientId,
        billing_year: year,
        billing_month: month
    });

    return doc ? { id: doc._id.toString(), numero_factura: doc.numero_factura } : null;
}

/**
 * Crea la factura mensual de un paciente a partir de sus sesiones
 * 'completed' no facturadas de ese año/mes. Todo ocurre en una única
 * transacción multi-documento:
 *   1. lee las citas pendientes de ese paciente/periodo dentro de la
 *      transacción (equivalente al FOR UPDATE: si otra transacción
 *      concurrente las toca a la vez, una de las dos aborta por conflicto
 *      de escritura y Mongo la reintenta);
 *   2. si no hay ninguna sesión pendiente, no crea nada y devuelve null
 *      (la comprobación se hace aquí, no confiando en lo que haya calculado
 *      el caller momentos antes);
 *   3. calcula el importe sumando amount_cents de esas citas (nunca se usa
 *      un total recibido del frontend);
 *   4. lee settings, calcula el número de factura, inserta la factura y
 *      marca cada cita como facturada (invoice_id);
 *   5. incrementa el contador de numeración.
 * El índice único (appointment_date, start_time) ya no aplica aquí, pero
 * el índice único parcial (patient_id, billing_year, billing_month) de
 * invoices actúa como red de seguridad final a nivel de base de datos.
 */
export async function createMonthlyInvoice({ patientId, year, month, concepto }) {
    const invoiceId = await withTransaction(async (session) => {
        const pendientes = await appointmentsRepository.findPendingByPatientAndMonth(patientId, year, month, session);

        if (pendientes.length === 0) {
            return null;
        }

        const totalCentimos = pendientes.reduce((suma, cita) => suma + cita.amount_cents, 0);

        const settings = await settingsRepository.getSettings(session);
        const numeroFactura = formatInvoiceNumber(settings.prefijo_factura, settings.siguiente_numero, year);

        const fechaEmision = new Date(Date.UTC(year, month, 0)); // último día del mes facturado
        const fechaEmisionStr = fechaEmision.toISOString().slice(0, 10);

        const doc = {
            numero_factura: numeroFactura,
            fecha: fechaEmisionStr,
            patient_id: new ObjectId(patientId),
            concepto,
            importe_centimos: totalCentimos,
            tipo_iva: 'exento',
            iva_centimos: 0,
            total_centimos: totalCentimos,
            estado: 'pendiente',
            metodo_pago: null,
            observaciones: null,
            fecha_creacion: new Date(),
            billing_year: year,
            billing_month: month,
            session_count: pendientes.length
        };

        const { insertedId } = await coleccion().insertOne(doc, { session });

        await appointmentsRepository.markAsInvoiced(session, pendientes.map((c) => c.id), insertedId);
        await settingsRepository.incrementInvoiceNumber(session, settings.id);

        return insertedId;
    });

    if (!invoiceId) return null;
    return findById(invoiceId);
}
