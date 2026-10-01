import { ObjectId } from 'mongodb';
import { getDb } from '../config/database.js';

function coleccion() {
    return getDb().collection('settings');
}

function toDto(doc) {
    if (!doc) return null;
    const { _id, ...resto } = doc;
    return { id: _id.toString(), ...resto };
}

/**
 * `session` es opcional: cuando se pasa (ver invoicesRepository.create),
 * la lectura participa en la misma transacción multi-documento que la
 * escritura posterior, igual que el `client` compartido en Postgres.
 */
export async function getSettings(session = undefined) {
    const doc = await coleccion().findOne({}, { sort: { _id: 1 }, session });
    return toDto(doc);
}

export async function updateSettings(id, data) {
    const resultado = await coleccion().findOneAndUpdate(
        { _id: new ObjectId(id) },
        {
            $set: {
                nombre: data.nombre,
                apellidos: data.apellidos,
                nif: data.nif || null,
                direccion: data.direccion || null,
                telefono: data.telefono || null,
                email: data.email || null,
                numero_colegiada: data.numero_colegiada || null,
                precio_defecto_centimos: data.precio_defecto_centimos,
                concepto_defecto: data.concepto_defecto,
                prefijo_factura: data.prefijo_factura,
                siguiente_numero: data.siguiente_numero
            }
        },
        { returnDocument: 'after' }
    );
    return toDto(resultado);
}

/**
 * Incrementa el contador de numeración de forma atómica dentro de la
 * transacción `session` de la creación de factura. $inc es atómico por sí
 * mismo en Mongo; la `session` es lo que lo ata al resto de operaciones
 * (inserción de la factura, vinculación de citas) para que todo se
 * confirme o revierta junto.
 */
export async function incrementInvoiceNumber(session, id) {
    await coleccion().updateOne(
        { _id: new ObjectId(id) },
        { $inc: { siguiente_numero: 1 } },
        { session }
    );
}
