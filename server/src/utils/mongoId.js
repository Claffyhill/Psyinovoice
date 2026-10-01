import { ObjectId } from 'mongodb';

/**
 * Convierte un id recibido de fuera (params de ruta, body) en un ObjectId.
 * Devuelve null si no tiene un formato válido, en vez de lanzar: así cada
 * repository puede tratarlo igual que un "no encontrado" (comportamiento
 * equivalente al que tenía Postgres con un id que no fuese un entero).
 */
export function toObjectId(id) {
    if (!id || !ObjectId.isValid(id) || String(new ObjectId(id)) !== String(id)) {
        return null;
    }
    return new ObjectId(id);
}
