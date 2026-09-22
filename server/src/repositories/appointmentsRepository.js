import { getDb } from '../config/database.js';
import { toObjectId } from '../utils/mongoId.js';

function coleccion() {
    return getDb().collection('appointments');
}

function toDto(doc) {
    if (!doc) return null;
    const paciente = doc.paciente || {};
    return {
        id: doc._id.toString(),
        patientId: doc.patient_id.toString(),
        patientFirstName: paciente.nombre ?? doc.patientFirstName,
        patientLastName: paciente.apellidos ?? doc.patientLastName,
        appointmentDate: doc.appointment_date,
        startTime: doc.start_time,
        endTime: doc.end_time,
        status: doc.status,
        amountCents: doc.amount_cents,
        bookingSource: doc.booking_source,
        administrativeNotes: doc.administrative_notes,
        createdAt: doc.created_at,
        invoiceId: doc.invoice_id ? doc.invoice_id.toString() : null
    };
}

// $lookup + $unwind reemplaza al JOIN con patients para traer nombre/apellidos.
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

export async function findAll(filters) {
    const match = {};

    if (filters.date) {
        match.appointment_date = filters.date;
    } else if (filters.dateFrom || filters.dateTo) {
        match.appointment_date = {};
        if (filters.dateFrom) match.appointment_date.$gte = filters.dateFrom;
        if (filters.dateTo) match.appointment_date.$lte = filters.dateTo;
    }
    if (filters.patientId) {
        const _id = toObjectId(filters.patientId);
        match.patient_id = _id || null; // id inválido -> no puede coincidir con nada
    }
    if (filters.status) match.status = filters.status;

    const docs = await coleccion().aggregate([
        { $match: match },
        ...LOOKUP_PACIENTE,
        { $sort: { appointment_date: 1, start_time: 1 } }
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

/**
 * Citas activas (no canceladas) de un día concreto, usadas para calcular
 * la disponibilidad y para detectar huecos ocupados.
 */
export async function findActiveByDate(date, session = undefined) {
    const docs = await coleccion().aggregate([
        { $match: { appointment_date: date, status: { $ne: 'cancelled' } } },
        ...LOOKUP_PACIENTE,
        { $sort: { start_time: 1 } }
    ], { session }).toArray();

    return docs.map(toDto);
}

/**
 * Comprueba si ya existe una cita activa cuyo intervalo [start_time, end_time)
 * se solape con [startTime, endTime). Se ejecuta dentro de la misma
 * transacción que la creación/edición para evitar condiciones de carrera.
 * Usa solapamiento de intervalos (no coincidencia exacta de hora) porque
 * las citas pueden tener una hora manual que no esté alineada con la
 * rejilla estándar de 45 minutos.
 */
export async function existsActiveAt(session, date, startTime, endTime, excludeId = null) {
    const filtro = {
        appointment_date: date,
        status: { $ne: 'cancelled' },
        start_time: { $lt: endTime },
        end_time: { $gt: startTime }
    };

    if (excludeId) {
        const _id = toObjectId(excludeId);
        if (_id) filtro._id = { $ne: _id };
    }

    const existente = await coleccion().findOne(filtro, { session });
    return existente !== null;
}

export async function create(data, session = undefined) {
    const _patientId = toObjectId(data.patientId);
    if (!_patientId) {
        throw Object.assign(new Error('patientId inválido'), { status: 400 });
    }

    const doc = {
        patient_id: _patientId,
        appointment_date: data.appointmentDate,
        start_time: data.startTime,
        end_time: data.endTime,
        status: data.status,
        amount_cents: data.amountCents,
        booking_source: data.bookingSource,
        administrative_notes: data.administrativeNotes || null,
        created_at: new Date(),
        invoice_id: null
    };

    const { insertedId } = await coleccion().insertOne(doc, { session });
    return insertedId.toString();
}

export async function update(id, data) {
    const _id = toObjectId(id);
    if (!_id) return null;

    const _patientId = toObjectId(data.patientId);
    if (!_patientId) return null;

    const resultado = await coleccion().findOneAndUpdate(
        { _id },
        {
            $set: {
                patient_id: _patientId,
                appointment_date: data.appointmentDate,
                start_time: data.startTime,
                end_time: data.endTime,
                amount_cents: data.amountCents,
                administrative_notes: data.administrativeNotes || null
            }
        },
        { returnDocument: 'after' }
    );
    return resultado ? { id: resultado._id.toString() } : null;
}

export async function updateStatus(id, status) {
    const _id = toObjectId(id);
    if (!_id) return null;

    const resultado = await coleccion().findOneAndUpdate(
        { _id },
        { $set: { status } },
        { returnDocument: 'after' }
    );
    return resultado ? { id: resultado._id.toString() } : null;
}

function prefijoAnioMes(year, month) {
    // appointment_date se guarda como "YYYY-MM-DD"; comparar por prefijo
    // "YYYY-MM-" equivale al EXTRACT(YEAR/MONTH) de Postgres, sin líos de zona horaria.
    return `^${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-`;
}

/**
 * Igual que findCompletedGroupedByMonth pero excluye por completo las citas
 * que ya están vinculadas a una factura (invoice_id ya asignado), en vez de
 * solo marcarlas con un flag. Se usa para la pantalla de facturación
 * pendiente, que no debe mostrar nada que ya esté facturado.
 */
export async function findPendingGroupedByMonth(year, month) {
    return coleccion().aggregate([
        {
            $match: {
                status: 'completed',
                invoice_id: null,
                appointment_date: { $regex: prefijoAnioMes(year, month) }
            }
        },
        { $sort: { appointment_date: 1 } },
        ...LOOKUP_PACIENTE,
        {
            $group: {
                _id: '$patient_id',
                patientFirstName: { $first: '$paciente.nombre' },
                patientLastName: { $first: '$paciente.apellidos' },
                sessionCount: { $sum: 1 },
                totalCents: { $sum: '$amount_cents' },
                appointmentIds: { $push: '$_id' },
                appointmentDates: { $push: '$appointment_date' }
            }
        },
        { $sort: { patientLastName: 1, patientFirstName: 1 } }
    ]).toArray().then((grupos) => grupos.map((g) => ({
        patientId: g._id.toString(),
        patientFirstName: g.patientFirstName,
        patientLastName: g.patientLastName,
        sessionCount: g.sessionCount,
        totalCents: g.totalCents,
        appointmentIds: g.appointmentIds.map((id) => id.toString()),
        appointmentDates: g.appointmentDates
    })));
}

/**
 * Citas 'completed' y no facturadas de UN paciente en un mes/año concreto.
 * Se usa al generar la factura mensual: da los ids e importes exactos que
 * hay que vincular, calculados en backend (nunca confiando en el frontend).
 */
export async function findPendingByPatientAndMonth(patientId, year, month, session = undefined) {
    const _patientId = toObjectId(patientId);
    if (!_patientId) return [];

    const docs = await coleccion().find(
        {
            patient_id: _patientId,
            status: 'completed',
            invoice_id: null,
            appointment_date: { $regex: prefijoAnioMes(year, month) }
        },
        { sort: { appointment_date: 1 }, session }
    ).toArray();

    return docs.map((d) => ({ id: d._id, appointment_date: d.appointment_date, amount_cents: d.amount_cents }));
}

/**
 * Marca como facturadas (asigna invoice_id) las citas indicadas. Sustituye
 * a los INSERT en la antigua tabla puente invoice_appointments: en Mongo,
 * "ya facturada" es simplemente que la cita tenga invoice_id asignado.
 */
export async function markAsInvoiced(session, appointmentIds, invoiceId) {
    await coleccion().updateMany(
        { _id: { $in: appointmentIds } },
        { $set: { invoice_id: invoiceId } },
        { session }
    );
}

/**
 * Citas 'completed' de un mes, agrupadas por paciente, con el número de
 * sesiones, el total en céntimos, los ids de las citas y si ya están
 * facturadas (invoice_id asignado en todas las citas del grupo).
 */
export async function findCompletedGroupedByMonth(year, month) {
    return coleccion().aggregate([
        {
            $match: {
                status: 'completed',
                appointment_date: { $regex: prefijoAnioMes(year, month) }
            }
        },
        { $sort: { appointment_date: 1 } },
        ...LOOKUP_PACIENTE,
        {
            $group: {
                _id: '$patient_id',
                patientFirstName: { $first: '$paciente.nombre' },
                patientLastName: { $first: '$paciente.apellidos' },
                sessionCount: { $sum: 1 },
                totalCents: { $sum: '$amount_cents' },
                appointmentIds: { $push: '$_id' },
                alreadyInvoiced: { $min: { $cond: [{ $ne: ['$invoice_id', null] }, 1, 0] } }
            }
        },
        { $sort: { patientLastName: 1, patientFirstName: 1 } }
    ]).toArray().then((grupos) => grupos.map((g) => ({
        patientId: g._id.toString(),
        patientFirstName: g.patientFirstName,
        patientLastName: g.patientLastName,
        sessionCount: g.sessionCount,
        totalCents: g.totalCents,
        appointmentIds: g.appointmentIds.map((id) => id.toString()),
        alreadyInvoiced: g.alreadyInvoiced === 1
    })));
}
