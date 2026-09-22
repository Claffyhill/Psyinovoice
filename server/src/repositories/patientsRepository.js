import { getDb } from '../config/database.js';
import { toObjectId } from '../utils/mongoId.js';

function coleccion() {
    return getDb().collection('patients');
}

function toDto(doc) {
    if (!doc) return null;
    const { _id, ...resto } = doc;
    return { id: _id.toString(), ...resto };
}

export async function findAll(search) {
    let filtro = {};

    if (search) {
        const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        filtro = { $or: [{ nombre: regex }, { apellidos: regex }, { dni: regex }] };
        // Coincidencia de "nombre apellidos" completo, igual que el
        // (nombre || ' ' || apellidos) ILIKE de Postgres, además de por campo suelto.
        const partes = search.trim().split(/\s+/);
        if (partes.length > 1) {
            filtro = {
                $or: [
                    filtro,
                    { $and: partes.map((parte) => ({
                        $or: [{ nombre: new RegExp(parte, 'i') }, { apellidos: new RegExp(parte, 'i') }]
                    })) }
                ]
            };
        }
    }

    const docs = await coleccion().find(filtro).sort({ apellidos: 1, nombre: 1 }).toArray();
    return docs.map(toDto);
}

export async function findById(id) {
    const _id = toObjectId(id);
    if (!_id) return null;

    const doc = await coleccion().findOne({ _id });
    return toDto(doc);
}

export async function create(patient) {
    const { nombre, apellidos, dni, telefono, email, direccion, fecha_nacimiento } = patient;

    const doc = {
        nombre,
        apellidos,
        dni: dni || null,
        telefono: telefono || null,
        email: email || null,
        direccion: direccion || null,
        fecha_nacimiento: fecha_nacimiento ? new Date(fecha_nacimiento) : null,
        fecha_creacion: new Date()
    };

    const { insertedId } = await coleccion().insertOne(doc);
    return toDto({ _id: insertedId, ...doc });
}

export async function update(id, patient) {
    const _id = toObjectId(id);
    if (!_id) return null;

    const { nombre, apellidos, dni, telefono, email, direccion, fecha_nacimiento } = patient;

    const resultado = await coleccion().findOneAndUpdate(
        { _id },
        {
            $set: {
                nombre,
                apellidos,
                dni: dni || null,
                telefono: telefono || null,
                email: email || null,
                direccion: direccion || null,
                fecha_nacimiento: fecha_nacimiento ? new Date(fecha_nacimiento) : null
            }
        },
        { returnDocument: 'after' }
    );
    return toDto(resultado);
}

export async function count() {
    return coleccion().countDocuments({});
}
