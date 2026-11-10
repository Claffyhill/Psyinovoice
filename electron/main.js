
const { app, BrowserWindow, dialog } = require('electron');
const { spawn } = require('node:child_process');
const path = require('node:path');
const net = require('node:net');

let mongoProcess = null;
let mainWindow = null;
let stopServer = null;
let isQuitting = false;

// Rutas temporales de desarrollo.
// Más adelante las adaptaremos al instalador.
const PROJECT_PATH = path.join(__dirname, '..');

const MONGO_PATH =
    'D:\\PsyInvoice\\MongoDB\\mongodb-win32-x86_64-windows-9.0.4\\bin\\mongod.exe';

const DATA_PATH = 'D:\\PsyInvoice\\MongoDB\\data';
const LOG_PATH = 'D:\\PsyInvoice\\MongoDB\\log\\mongod.log';

const MONGO_PORT = 27017;
const SERVER_URL = 'http://127.0.0.1:3000';

// Comprueba que MongoDB responde en el puerto.
function waitForMongo(timeout = 30000) {
    return new Promise((resolve, reject) => {
        const start = Date.now();

        function check() {
            const socket = net.createConnection({
                host: '127.0.0.1',
                port: MONGO_PORT
            });

            socket.setTimeout(1000);

            socket.once('connect', () => {
                socket.destroy();
                resolve();
            });

            socket.once('timeout', () => {
                socket.destroy();
                retry();
            });

            socket.once('error', () => {
                socket.destroy();
                retry();
            });
        }

        function retry() {
            if (Date.now() - start >= timeout) {
                reject(new Error('MongoDB no ha arrancado a tiempo.'));
                return;
            }

            setTimeout(check, 500);
        }

        check();
    });
}

// Arranca MongoDB.
function startMongo() {
    return new Promise((resolve, reject) => {
        mongoProcess = spawn(MONGO_PATH, [
            '--dbpath', DATA_PATH,
            '--port', String(MONGO_PORT),
            '--bind_ip', '127.0.0.1',
            '--replSet', 'rs0',
            '--logpath', LOG_PATH
        ], {
            windowsHide: true,
            stdio: 'ignore'
        });

        mongoProcess.once('error', (error) => {
            reject(error);
        });

        mongoProcess.once('exit', (code) => {
            mongoProcess = null;

            if (!isQuitting) {
                console.error('MongoDB terminó inesperadamente. Código:', code);
            }
        });

        resolve();
    });
}

// Comprueba que el replica set está preparado.
async function waitForMongoPrimary(timeout = 30000) {
    const { MongoClient } = require('mongodb');

    const client = new MongoClient(
        `mongodb://127.0.0.1:${MONGO_PORT}/?directConnection=true`,
        { serverSelectionTimeoutMS: 2000 }
    );

    const start = Date.now();

    try {
        await client.connect();

        while (Date.now() - start < timeout) {
            try {
                const status = await client.db('admin').command({
                    replSetGetStatus: 1
                });

                const primary = status.members?.some(
                    member => member.stateStr === 'PRIMARY'
                );

                if (primary) return;
            } catch {
                // El replica set todavía puede estar iniciándose.
            }

            await new Promise(resolve => setTimeout(resolve, 500));
        }

        throw new Error('MongoDB no ha alcanzado el estado PRIMARY.');
    } finally {
        await client.close();
    }
}

// Abre la ventana principal.
async function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        show: false,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    await mainWindow.loadURL(SERVER_URL);

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Arranque de PsyInvoice.
app.whenReady().then(async () => {
    try {
        await startMongo();
        await waitForMongo();
        await waitForMongoPrimary();

        const backend = await import('../server/src/app.js');

        await backend.startServer();
        stopServer = backend.stopServer;

        await createWindow();
    } catch (error) {
        console.error('Error al iniciar PsyInvoice:', error);

        await dialog.showMessageBox({
            type: 'error',
            title: 'Error al iniciar PsyInvoice',
            message: 'No se ha podido iniciar la aplicación.',
            detail: error.message
        });

        app.quit();
    }
});

// Cierre ordenado.
app.on('before-quit', (event) => {
    if (isQuitting) return;

    event.preventDefault();
    isQuitting = true;

    shutdown();
});

async function shutdown() {
    try {
        // Primero cerramos Express y su conexión con MongoDB.
        if (stopServer) {
            await stopServer();
            stopServer = null;
        }

        // Después detenemos MongoDB.
        if (mongoProcess) {
            const processToStop = mongoProcess;

            await new Promise(resolve => {
                processToStop.once('exit', resolve);
                processToStop.kill();
            });

            mongoProcess = null;
        }
    } catch (error) {
        console.error('Error durante el cierre:', error);
    } finally {
        app.exit(0);
    }
}

// Evita crear otra ventana innecesariamente.
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && !isQuitting) {
        createWindow().catch(console.error);
    }
});
