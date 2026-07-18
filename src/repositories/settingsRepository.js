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

export async function updateSettings(id, data) {
    const { rows } = await pool.query(
        `UPDATE settings
         SET nombre = $1,
             apellidos = $2,
             nif = $3,
             direccion = $4,
             telefono = $5,
             email = $6,
             numero_colegiada = $7,
             precio_defecto_centimos = $8,
             concepto_defecto = $9,
             prefijo_factura = $10,
             siguiente_numero = $11
         WHERE id = $12
         RETURNING id, nombre, apellidos, nif, direccion, telefono, email,
                   numero_colegiada, precio_defecto_centimos, concepto_defecto,
                   prefijo_factura, siguiente_numero`,
        [
            data.nombre,
            data.apellidos,
            data.nif || null,
            data.direccion || null,
            data.telefono || null,
            data.email || null,
            data.numero_colegiada || null,
            data.precio_defecto_centimos,
            data.concepto_defecto,
            data.prefijo_factura,
            data.siguiente_numero,
            id
        ]
    );
    return rows[0] || null;
}

export async function incrementInvoiceNumber(client, id) {
    await client.query(
        `UPDATE settings SET siguiente_numero = siguiente_numero + 1 WHERE id = $1`,
        [id]
    );
}
