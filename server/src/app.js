import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

import { apiRouter } from './routes/index.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { connectDB } from './config/database.js';

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

async function start() {
    // La conexión a MongoDB se abre una sola vez al arrancar; si falla,
    // la app no debe empezar a aceptar peticiones.
    await connectDB();

    app.listen(PORT, () => {
        console.log(`PsyInvoice escuchando en http://localhost:${PORT}`);
    });
}

start().catch((err) => {
    console.error('Error arrancando PsyInvoice:', err);
    process.exit(1);
});
