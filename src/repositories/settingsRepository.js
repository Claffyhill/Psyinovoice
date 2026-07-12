import { pool } from '../config/database.js';

export async function getSettings(client = pool) {
    const { rows } = await client.query(
        `SELECT id, nombre, apellidos, nif, direccion, telefono, email,
                numero_colegiada, precio_defecto_centimos, concepto_defecto,
                prefijo_factura, siguiente_numero
         FROM settings
         ORDER BY id
         LIMIT 1`
    );
    return rows[0] || null;
}

export async function incrementInvoiceNumber(client, id) {
    await client.query(
        `UPDATE settings SET siguiente_numero = siguiente_numero + 1 WHERE id = $1`,
        [id]
    );
}
