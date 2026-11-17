
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { initializeDatabase } from './database/initMongo.js';

import { apiRouter } from './routes/index.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { connectDB, closeDB } from './config/database.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicPath = path.join(__dirname, '..', '..', 'public');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(publicPath));

app.use('/api', apiRouter);

app.use('/api', notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

let server = null;

export async function startServer() {
    if (server) {
        return server;
    }

    try {
        const db = await connectDB();

        // Inicializar MongoDB antes de aceptar peticiones.
        await initializeDatabase(db);

    } catch (err) {
        await closeDB();
        throw err;
    }

    return new Promise((resolve, reject) => {
        const httpServer = app.listen(PORT, '127.0.0.1');

        httpServer.once('error', async (err) => {
            await closeDB();
            reject(err);
        });

        httpServer.once('listening', () => {
            server = httpServer;
            console.log(`PsyInvoice escuchando en http://127.0.0.1:${PORT}`);
            resolve(server);
        });
    });
}

export async function stopServer() {
    if (server) {
        await new Promise((resolve, reject) => {
            server.close((err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        server = null;
    }

    await closeDB();
}
