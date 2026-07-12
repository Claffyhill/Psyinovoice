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

