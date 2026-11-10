import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/?directConnection=true';
const dbName = process.env.MONGODB_DB_NAME || 'psyinvoice';

export const client = new MongoClient(uri);

let db = null;

/**
 * Abre la conexión con MongoDB. Debe llamarse una vez al arrancar la
 * aplicación (ver app.js) antes de que se sirva ninguna petición.
 */
export async function connectDB() {
    if (db) return db;

    await client.connect();
    db = client.db(dbName);
    console.log(`Conectado a MongoDB (${dbName})`);
    return db;
}

/**
 * Comprueba si hay una conexión abierta, cierra el cliente de MongoDB y restablede db a null
 * Permite que el proceso termine sin dejar conexiones abiertas
 */

export async function closeDB() {
    if (!db) return;

    await client.close();
    db = null;
    console.log('Conexión con MongoDB cerrada');
}



/**
 * Devuelve el handle de la base de datos ya conectada. Lanza si se llama
 * antes de connectDB() (fallo de arranque, no de petición individual).
 */
export function getDb() {
    if (!db) {
        throw new Error('La base de datos no está conectada todavía. Llama a connectDB() al arrancar la app.');
    }
    return db;
}

/**
 * Ejecuta `fn` dentro de una transacción multi-documento (requiere que
 * MongoDB corra como replica set, incluido un despliegue de un solo nodo
 * iniciado con --replSet). Sustituye a los BEGIN/COMMIT/ROLLBACK de
 * PostgreSQL: si `fn` lanza, la transacción se aborta automáticamente.
 *
 * `fn` recibe la `session` de Mongo, que debe pasarse a cada operación
 * que deba participar en la transacción (ver repositories/*.js).
 */
export async function withTransaction(fn) {
    const session = client.startSession();
    try {
        let resultado;
        await session.withTransaction(async () => {
            resultado = await fn(session);
        });
        return resultado;
    } finally {
        await session.endSession();
    }
}

client.on('error', (err) => {
    console.error('Error inesperado en el cliente de MongoDB:', err.message);
});
