import { pool } from '../config/database.js';

export async function findAll(search) {
    if (search) {
        const { rows } = await pool.query(
            `SELECT id, nombre, apellidos, dni, telefono, email, direccion, fecha_creacion
             FROM patients
             WHERE (nombre || ' ' || apellidos) ILIKE $1
                OR dni ILIKE $1
             ORDER BY apellidos, nombre`,
            [`%${search}%`]
        );
        return rows;
    }

    const { rows } = await pool.query(
        `SELECT id, nombre, apellidos, dni, telefono, email, direccion, fecha_creacion
         FROM patients
         ORDER BY apellidos, nombre`
    );
    return rows;
}

export async function findById(id) {
    const { rows } = await pool.query(
        `SELECT id, nombre, apellidos, dni, telefono, email, direccion, fecha_creacion
         FROM patients
         WHERE id = $1`,
        [id]
    );
    return rows[0] || null;
}

export async function create(patient) {
    const { nombre, apellidos, dni, telefono, email, direccion } = patient;

    const { rows } = await pool.query(
        `INSERT INTO patients (nombre, apellidos, dni, telefono, email, direccion)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, nombre, apellidos, dni, telefono, email, direccion, fecha_creacion`,
        [nombre, apellidos, dni || null, telefono || null, email || null, direccion || null]
    );
    return rows[0];
}

export async function update(id, patient) {
    const { nombre, apellidos, dni, telefono, email, direccion } = patient;

    const { rows } = await pool.query(
        `UPDATE patients
         SET nombre = $1, apellidos = $2, dni = $3, telefono = $4, email = $5, direccion = $6
         WHERE id = $7
         RETURNING id, nombre, apellidos, dni, telefono, email, direccion, fecha_creacion`,
        [nombre, apellidos, dni || null, telefono || null, email || null, direccion || null, id]
    );
    return rows[0] || null;
}

export async function count() {
    const { rows } = await pool.query('SELECT COUNT(*)::int AS total FROM patients');
    return rows[0].total;
}
