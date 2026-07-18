import { pool } from '../config/database.js';

const SELECT_BASE = `
    SELECT
        a.id,
        a.patient_id AS "patientId",
        p.nombre AS "patientFirstName",
        p.apellidos AS "patientLastName",
        a.appointment_date AS "appointmentDate",
        a.start_time AS "startTime",
        a.end_time AS "endTime",
        a.status,
        a.amount_cents AS "amountCents",
        a.booking_source AS "bookingSource",
        a.administrative_notes AS "administrativeNotes",
        a.created_at AS "createdAt"
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
`;

export async function findAll(filters) {
    const condiciones = [];
    const valores = [];

    if (filters.date) {
        valores.push(filters.date);
        condiciones.push(`a.appointment_date = $${valores.length}`);
    }

    if (filters.dateFrom) {
        valores.push(filters.dateFrom);
        condiciones.push(`a.appointment_date >= $${valores.length}`);
    }

    if (filters.dateTo) {
        valores.push(filters.dateTo);
        condiciones.push(`a.appointment_date <= $${valores.length}`);
    }

    if (filters.patientId) {
        valores.push(filters.patientId);
        condiciones.push(`a.patient_id = $${valores.length}`);
    }

    if (filters.status) {
        valores.push(filters.status);
        condiciones.push(`a.status = $${valores.length}`);
    }

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const { rows } = await pool.query(
        `${SELECT_BASE} ${where} ORDER BY a.appointment_date, a.start_time`,
        valores
    );
    return rows;
}

export async function findById(id) {
    const { rows } = await pool.query(`${SELECT_BASE} WHERE a.id = $1`, [id]);
    return rows[0] || null;
}

/**
 * Citas activas (no canceladas) de un día concreto, usadas para calcular
 * la disponibilidad y para detectar huecos ocupados.
 */
export async function findActiveByDate(date, client = pool) {
    const { rows } = await client.query(
        `${SELECT_BASE} WHERE a.appointment_date = $1 AND a.status != 'cancelled' ORDER BY a.start_time`,
        [date]
    );
    return rows;
}

/**
 * Comprueba si ya existe una cita activa en esa fecha/hora. Se ejecuta
 * dentro de la misma transacción que la creación para evitar condiciones de carrera.
 */
export async function existsActiveAt(client, date, startTime, excludeId = null) {
    const valores = [date, startTime];
    let condicionExcluir = '';

    if (excludeId) {
        valores.push(excludeId);
        condicionExcluir = `AND id != $${valores.length}`;
    }

    const { rows } = await client.query(
        `SELECT id FROM appointments
         WHERE appointment_date = $1 AND start_time = $2 AND status != 'cancelled'
         ${condicionExcluir}`,
        valores
    );
    return rows.length > 0;
}

export async function create(data, client = pool) {
    const { rows } = await client.query(
        `INSERT INTO appointments (
            patient_id, appointment_date, start_time, end_time,
            status, amount_cents, booking_source, administrative_notes
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
            data.patientId,
            data.appointmentDate,
            data.startTime,
            data.endTime,
            data.status,
            data.amountCents,
            data.bookingSource,
            data.administrativeNotes || null
        ]
    );
    return rows[0].id;
}

export async function update(id, data) {
    const { rows } = await pool.query(
        `UPDATE appointments
         SET patient_id = $1,
             appointment_date = $2,
             start_time = $3,
             end_time = $4,
             amount_cents = $5,
             administrative_notes = $6
         WHERE id = $7
         RETURNING id`,
        [
            data.patientId,
            data.appointmentDate,
            data.startTime,
            data.endTime,
            data.amountCents,
            data.administrativeNotes || null,
            id
        ]
    );
    return rows[0] || null;
}

export async function updateStatus(id, status) {
    const { rows } = await pool.query(
        `UPDATE appointments SET status = $1 WHERE id = $2 RETURNING id`,
        [status, id]
    );
    return rows[0] || null;
}

/**
 * Citas 'completed' de un mes, agrupadas por paciente, con el número de
 * sesiones, el total en céntimos, los ids de las citas y si ya están
 * facturadas (presentes en invoice_appointments).
 */
export async function findCompletedGroupedByMonth(year, month) {
    const { rows } = await pool.query(
        `SELECT
            a.patient_id AS "patientId",
            p.nombre AS "patientFirstName",
            p.apellidos AS "patientLastName",
            COUNT(*)::int AS "sessionCount",
            SUM(a.amount_cents)::int AS "totalCents",
            ARRAY_AGG(a.id ORDER BY a.appointment_date) AS "appointmentIds",
            BOOL_AND(ia.id IS NOT NULL) AS "alreadyInvoiced"
         FROM appointments a
         JOIN patients p ON p.id = a.patient_id
         LEFT JOIN invoice_appointments ia ON ia.appointment_id = a.id
         WHERE a.status = 'completed'
           AND EXTRACT(YEAR FROM a.appointment_date) = $1
           AND EXTRACT(MONTH FROM a.appointment_date) = $2
         GROUP BY a.patient_id, p.nombre, p.apellidos
         ORDER BY p.apellidos, p.nombre`,
        [year, month]
    );
    return rows;
}
