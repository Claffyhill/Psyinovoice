import { pool } from '../config/database.js';
import { formatInvoiceNumber } from '../utils/invoiceNumber.js';

const SELECT_BASE = `
    SELECT
        i.id,
        i.numero_factura,
        i.fecha,
        i.patient_id,
        p.nombre AS paciente_nombre,
        p.apellidos AS paciente_apellidos,
        i.concepto,
        i.importe_centimos,
        i.tipo_iva,
        i.iva_centimos,
        i.total_centimos,
        i.estado,
        i.metodo_pago,
        i.observaciones,
        i.fecha_creacion
    FROM invoices i
    JOIN patients p ON p.id = i.patient_id
`;

export async function findAll(filters) {
    const condiciones = [];
    const valores = [];

    if (filters.search) {
        valores.push(`%${filters.search}%`);
        condiciones.push(
            `(i.numero_factura ILIKE $${valores.length} OR (p.nombre || ' ' || p.apellidos) ILIKE $${valores.length})`
        );
    }

    if (filters.status) {
        valores.push(filters.status);
        condiciones.push(`i.estado = $${valores.length}`);
    }

    if (filters.year) {
        valores.push(filters.year);
        condiciones.push(`EXTRACT(YEAR FROM i.fecha) = $${valores.length}`);
    }

    if (filters.quarter) {
        valores.push(filters.quarter);
        condiciones.push(`EXTRACT(QUARTER FROM i.fecha) = $${valores.length}`);
    }

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const { rows } = await pool.query(
        `${SELECT_BASE} ${where} ORDER BY i.fecha DESC, i.id DESC`,
        valores
    );
    return rows;
}

export async function findById(id) {
    const { rows } = await pool.query(`${SELECT_BASE} WHERE i.id = $1`, [id]);
    return rows[0] || null;
}

const SELECT_PARA_PDF = `
    SELECT
        i.id,
        i.numero_factura,
        i.fecha,
        i.concepto,
        i.importe_centimos,
        i.tipo_iva,
        i.iva_centimos,
        i.total_centimos,
        i.estado,
        i.metodo_pago,
        i.observaciones,
        p.nombre AS paciente_nombre,
        p.apellidos AS paciente_apellidos,
        p.dni AS paciente_dni,
        p.direccion AS paciente_direccion,
        p.email AS paciente_email
    FROM invoices i
    JOIN patients p ON p.id = i.patient_id
    WHERE i.id = $1
`;

export async function findByIdForPdf(id) {
    const { rows } = await pool.query(SELECT_PARA_PDF, [id]);
    return rows[0] || null;
}

const SELECT_TRIMESTRE_PARA_PDF = `
    SELECT
        i.id,
        i.numero_factura,
        i.fecha,
        i.concepto,
        i.importe_centimos,
        i.tipo_iva,
        i.iva_centimos,
        i.total_centimos,
        i.estado,
        i.metodo_pago,
        i.observaciones,
        p.nombre AS paciente_nombre,
        p.apellidos AS paciente_apellidos,
        p.dni AS paciente_dni,
        p.direccion AS paciente_direccion,
        p.email AS paciente_email
    FROM invoices i
    JOIN patients p ON p.id = i.patient_id
    WHERE EXTRACT(YEAR FROM i.fecha) = $1 AND EXTRACT(QUARTER FROM i.fecha) = $2
    ORDER BY i.fecha ASC, i.id ASC
`;

export async function findByQuarterForPdf(year, quarter) {
    const { rows } = await pool.query(SELECT_TRIMESTRE_PARA_PDF, [year, quarter]);
    return rows;
}

/**
 * Crea una factura asignando el número de forma atómica:
 * bloquea la fila de settings, calcula el número, inserta la factura
 * e incrementa el contador, todo dentro de la misma transacción.
 */
export async function create(invoice) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const { rows: settingsRows } = await client.query(
            `SELECT id, prefijo_factura, siguiente_numero
             FROM settings
             ORDER BY id
             LIMIT 1
             FOR UPDATE`
        );
        const settings = settingsRows[0];

        const anio = new Date(invoice.fecha).getFullYear();
        const numeroFactura = formatInvoiceNumber(
            settings.prefijo_factura,
            settings.siguiente_numero,
            anio
        );

        const { rows: invoiceRows } = await client.query(
            `INSERT INTO invoices (
                numero_factura, fecha, patient_id, concepto, importe_centimos,
                tipo_iva, iva_centimos, total_centimos, estado, metodo_pago, observaciones
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING id`,
            [
                numeroFactura,
                invoice.fecha,
                invoice.patient_id,
                invoice.concepto,
                invoice.importe_centimos,
                invoice.tipo_iva,
                invoice.iva_centimos,
                invoice.total_centimos,
                invoice.estado,
                invoice.metodo_pago || null,
                invoice.observaciones || null
            ]
        );

        await client.query(
            `UPDATE settings SET siguiente_numero = siguiente_numero + 1 WHERE id = $1`,
            [settings.id]
        );

        await client.query('COMMIT');

        return findById(invoiceRows[0].id);
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

export async function updateStatus(id, estado) {
    const { rows } = await pool.query(
        `UPDATE invoices SET estado = $1 WHERE id = $2 RETURNING id`,
        [estado, id]
    );

    if (!rows[0]) {
        return null;
    }

    return findById(id);
}

<<<<<<< HEAD
=======
/**
 * Busca si ya existe una factura mensual para ese paciente/año/mes.
 * Se usa para dar un mensaje de error claro ANTES de intentar el INSERT
 * (el índice único parcial de la migración 004 actúa como red de seguridad
 * final ante condiciones de carrera).
 */
export async function findByPatientAndBillingPeriod(patientId, year, month) {
    const { rows } = await pool.query(
        `SELECT id, numero_factura
         FROM invoices
         WHERE patient_id = $1 AND billing_year = $2 AND billing_month = $3`,
        [patientId, year, month]
    );
    return rows[0] || null;
}

/**
 * Crea la factura mensual de un paciente a partir de sus sesiones
 * 'completed' no facturadas de ese año/mes. Todo ocurre en una única
 * transacción:
 *   1. bloquea las citas pendientes de ese paciente/periodo (FOR UPDATE)
 *      para que dos peticiones concurrentes no puedan facturar las mismas
 *      sesiones dos veces;
 *   2. si no hay ninguna sesión pendiente, no crea nada y devuelve null
 *      (la comprobación se hace aquí, no confiando en lo que haya calculado
 *      el caller momentos antes);
 *   3. calcula el importe sumando amount_cents de esas citas (nunca se usa
 *      un total recibido del frontend);
 *   4. bloquea settings, calcula el número de factura, inserta la factura
 *      y vincula cada cita en invoice_appointments;
 *   5. incrementa el contador de numeración.
 * El UNIQUE(appointment_id) de invoice_appointments y el índice único
 * parcial (patient_id, billing_year, billing_month) de invoices actúan
 * como red de seguridad final a nivel de base de datos.
 */
export async function createMonthlyInvoice({ patientId, year, month, concepto }) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const { rows: pendientes } = await client.query(
            `SELECT a.id, a.amount_cents
             FROM appointments a
             WHERE a.patient_id = $1
               AND a.status = 'completed'
               AND EXTRACT(YEAR FROM a.appointment_date) = $2
               AND EXTRACT(MONTH FROM a.appointment_date) = $3
               AND NOT EXISTS (
                   SELECT 1 FROM invoice_appointments ia WHERE ia.appointment_id = a.id
               )
             ORDER BY a.appointment_date
             FOR UPDATE OF a`,
            [patientId, year, month]
        );

        if (pendientes.length === 0) {
            await client.query('ROLLBACK');
            return null;
        }

        const totalCentimos = pendientes.reduce((suma, cita) => suma + cita.amount_cents, 0);

        const { rows: settingsRows } = await client.query(
            `SELECT id, prefijo_factura, siguiente_numero FROM settings ORDER BY id LIMIT 1 FOR UPDATE`
        );
        const settings = settingsRows[0];
        const numeroFactura = formatInvoiceNumber(settings.prefijo_factura, settings.siguiente_numero, year);

        const fechaEmision = new Date(Date.UTC(year, month, 0)); // último día del mes facturado

        const { rows: invoiceRows } = await client.query(
            `INSERT INTO invoices (
                numero_factura, fecha, patient_id, concepto, importe_centimos,
                tipo_iva, iva_centimos, total_centimos, estado,
                billing_year, billing_month, session_count
             )
             VALUES ($1, $2, $3, $4, $5, 'exento', 0, $5, 'pendiente', $6, $7, $8)
             RETURNING id`,
            [numeroFactura, fechaEmision, patientId, concepto, totalCentimos, year, month, pendientes.length]
        );
        const invoiceId = invoiceRows[0].id;

        for (const cita of pendientes) {
            await client.query(
                `INSERT INTO invoice_appointments (invoice_id, appointment_id) VALUES ($1, $2)`,
                [invoiceId, cita.id]
            );
        }

        await client.query(
            `UPDATE settings SET siguiente_numero = siguiente_numero + 1 WHERE id = $1`,
            [settings.id]
        );

        await client.query('COMMIT');

        return findById(invoiceId);
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

>>>>>>> 3d2b9cc (v. calendario bdd)
