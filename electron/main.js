
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

// Comprobar que la base de datos existe antes de arrancar MongoDB.
const fs = require('node:fs');

function validateDatabasePath() {
    if (!fs.existsSync(DATA_PATH)) {
        throw new Error(
            `No se encuentra la carpeta de datos de PsyInvoice:\n${DATA_PATH}\n\n` +
            'Comprueba que el disco está conectado y que la ruta es correcta. ' +
            'No se creará una base de datos nueva automáticamente.'
        );
    }

    if (!fs.existsSync(path.join(DATA_PATH, 'WiredTiger'))) {
        throw new Error(
            'La carpeta de datos no parece contener una base de datos MongoDB válida. ' +
            'Se ha cancelado el arranque para proteger los datos existentes.'
        );
    }

    if (!fs.existsSync(path.dirname(LOG_PATH))) {
        throw new Error('No se encuentra la carpeta de registros de MongoDB.');
    }
}

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
        const process = spawn(MONGO_PATH, [
            '--dbpath', DATA_PATH,
            '--port', String(MONGO_PORT),
            '--bind_ip', '127.0.0.1',
            '--replSet', 'rs0',
            '--logpath', LOG_PATH
        ], {
            windowsHide: true,
            stdio: 'ignore'
        });

        mongoProcess = process;

        process.once('error', (error) => {
            mongoProcess = null;
            reject(error);
        });

        process.once('spawn', () => {
            resolve();
        });

        process.once('exit', (code) => {
            if (mongoProcess === process) {
                mongoProcess = null;
            }

            if (!isQuitting) {
                console.error('MongoDB terminó inesperadamente. Código:', code);
            }
        });
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
        while (Date.now() - start < timeout) {
            try {
                await client.connect();

                const status = await client.db('admin').command({
                    replSetGetStatus: 1
                });

                const primary = status.members?.some(
                    member => member.stateStr === 'PRIMARY'
                );

                if (primary) return;
            } catch {
                // MongoDB o el replica set todavía se están iniciando.
            }

            await client.close().catch(() => {});

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
        validateDatabasePath();
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

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
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
        if (stopServer) {
            await stopServer();
            stopServer = null;
        }
    } catch (error) {
        console.error('Error al cerrar Express:', error);
    }

    try {
        if (mongoProcess) {
            const { MongoClient } = require('mongodb');

            const client = new MongoClient(
                `mongodb://127.0.0.1:${MONGO_PORT}/?directConnection=true`,
                { serverSelectionTimeoutMS: 3000 }
            );

            try {
                await client.connect();

                await client.db('admin').command({
                    shutdown: 1
                });
            } catch (error) {
                console.log('MongoDB está cerrándose:', error.message);
            } finally {
                await client.close().catch(() => {});
            }

            const processToStop = mongoProcess;

            if (processToStop) {
                await new Promise(resolve => {
                    const timeout = setTimeout(() => {
                        if (mongoProcess === processToStop) {
                            processToStop.kill();
                        }
                        resolve();
                    }, 10000);

                    processToStop.once('exit', () => {
                        clearTimeout(timeout);
                        resolve();
                    });
                });

                mongoProcess = null;
            }
        }
    } catch (error) {
        console.error('Error al cerrar MongoDB:', error);
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
