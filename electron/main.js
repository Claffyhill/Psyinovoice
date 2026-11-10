
const { app, BrowserWindow, dialog } = require('electron');
const { spawn } = require('node:child_process');
const path = require('node:path');
const net = require('node:net');
const fs = require('node:fs');
const { MongoClient } = require('mongodb');

// =========================================================
// Procesos y ventanas
// =========================================================

let mongoProcess = null;
let mainWindow = null;
let stopServer = null;
let isQuitting = false;

// MongoDB propio de PsyInvoice solamente en Windows.
const managesMongo = process.platform === 'win32';

// =========================================================
// Rutas de la aplicación
// =========================================================

const PROJECT_PATH = path.join(__dirname, '..');

const MONGO_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'mongodb', 'bin', 'mongod.exe')
    : path.join(PROJECT_PATH, 'resources', 'mongodb', 'bin', 'mongod.exe');

// Configuración persistente de Electron.
const CONFIG_DIR = app.getPath('userData');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

// Rutas configuradas durante el arranque.
let DATA_PATH = null;
let LOG_PATH = null;

// Configuración de conexión.
const MONGO_PORT = 27017;
const SERVER_URL = 'http://127.0.0.1:3000';

const MONGO_URI =
    `mongodb://127.0.0.1:${MONGO_PORT}/?directConnection=true`;

// =========================================================
// Carga de la ubicación de los datos (Windows)
// =========================================================


async function loadDataPath() {
    let config = null;

    fs.mkdirSync(CONFIG_DIR, { recursive: true });

    // Recuperar configuración existente.
    if (fs.existsSync(CONFIG_PATH)) {
        try {
            config = JSON.parse(
                fs.readFileSync(CONFIG_PATH, 'utf8')
            );
        } catch {
            throw new Error(
                'El archivo de configuración de PsyInvoice está dañado.'
            );
        }
    }

    // Si no existe configuración, utilizar automáticamente
    // la carpeta general de PsyInvoice.
    if (!config?.dataDirectory) {
        config = {
            dataDirectory: CONFIG_DIR
        };

        fs.writeFileSync(
            CONFIG_PATH,
            JSON.stringify(config, null, 4),
            'utf8'
        );
    }

    const selectedDirectory = config.dataDirectory;

    if (
        typeof selectedDirectory !== 'string' ||
        !path.isAbsolute(selectedDirectory) ||
        !fs.existsSync(selectedDirectory)
    ) {
        throw new Error(
            'La ubicación guardada para los datos de PsyInvoice no está disponible.'
        );
    }

    // Compatibilidad con la antigua estructura de datos.
    const oldDataPath = path.join(selectedDirectory, 'data');

    if (fs.existsSync(path.join(oldDataPath, 'WiredTiger'))) {
        DATA_PATH = oldDataPath;

        LOG_PATH = path.join(
            selectedDirectory,
            'log',
            'mongod.log'
        );
    } else {
        // Nueva estructura automática.
        const psyInvoiceDirectory = path.join(
            selectedDirectory,
            'PsyInvoiceData'
        );

        DATA_PATH = path.join(psyInvoiceDirectory, 'data');

        LOG_PATH = path.join(
            psyInvoiceDirectory,
            'logs',
            'mongod.log'
        );

        fs.mkdirSync(
            path.join(psyInvoiceDirectory, 'backups'),
            { recursive: true }
        );
    }

    fs.mkdirSync(DATA_PATH, { recursive: true });
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });

    // Comprobar que no estamos utilizando una carpeta
    // que contenga datos ajenos a una base de datos válida.
    const files = fs.readdirSync(DATA_PATH);

    if (
        files.length > 0 &&
        !fs.existsSync(path.join(DATA_PATH, 'WiredTiger'))
    ) {
        throw new Error(
            'La carpeta de datos contiene archivos, pero no parece ' +
            'una base de datos MongoDB válida. Se ha cancelado el arranque ' +
            'para proteger los datos existentes.'
        );
    }
}


// =========================================================
// Validación de las rutas (Windows)
// =========================================================

function validateDatabasePath() {
    if (!fs.existsSync(MONGO_PATH)) {
        throw new Error(
            `No se encuentra el ejecutable de MongoDB:\n${MONGO_PATH}`
        );
    }

    if (!fs.existsSync(DATA_PATH)) {
        throw new Error(
            `No se encuentra la carpeta de datos:\n${DATA_PATH}`
        );
    }

    if (!fs.existsSync(path.dirname(LOG_PATH))) {
        throw new Error(
            'No se encuentra la carpeta de registros de MongoDB.'
        );
    }
}

// =========================================================
// Comprobación del puerto (Windows)
// =========================================================

function checkMongoPortAvailable() {
    return new Promise((resolve, reject) => {
        const socket = net.createConnection({
            host: '127.0.0.1',
            port: MONGO_PORT
        });

        socket.once('connect', () => {
            socket.destroy();

            reject(
                new Error(
                    `El puerto ${MONGO_PORT} ya está en uso. ` +
                    'Puede que otra instancia de MongoDB esté ejecutándose.'
                )
            );
        });

        socket.once('error', (error) => {
            socket.destroy();

            if (error.code === 'ECONNREFUSED') {
                resolve();
            } else {
                reject(error);
            }
        });
    });
}

// =========================================================
// Espera a que MongoDB responda
// =========================================================

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
                reject(
                    new Error('MongoDB no ha arrancado a tiempo.')
                );
                return;
            }

            setTimeout(check, 500);
        }

        check();
    });
}

// =========================================================
// Arranque de MongoDB (Windows)
// =========================================================

function startMongo() {
    return new Promise((resolve, reject) => {
        const child = spawn(MONGO_PATH, [
            '--dbpath', DATA_PATH,
            '--port', String(MONGO_PORT),
            '--bind_ip', '127.0.0.1',
            '--replSet', 'rs0',
            '--logpath', LOG_PATH
        ], {
            windowsHide: true,
            stdio: 'ignore'
        });

        mongoProcess = child;

        child.once('error', (error) => {
            mongoProcess = null;
            reject(error);
        });

        child.once('spawn', () => {
            resolve();
        });

        child.once('exit', (code) => {
            if (mongoProcess === child) {
                mongoProcess = null;
            }

            if (!isQuitting) {
                console.error(
                    'MongoDB terminó inesperadamente. Código:',
                    code
                );
            }
        });
    });
}

// =========================================================
// Inicialización del replica set
// =========================================================

async function initializeReplicaSetIfNeeded() {
    const client = new MongoClient(
        MONGO_URI,
        { serverSelectionTimeoutMS: 5000 }
    );

    try {
        await client.connect();

        try {
            await client.db('admin').command({
                replSetGetStatus: 1
            });

            // El replica set ya está inicializado.
            return;

        } catch (error) {
            if (
                error.code !== 94 &&
                error.codeName !== 'NotYetInitialized'
            ) {
                throw error;
            }
        }

        console.log('Inicializando replica set...');

        await client.db('admin').command({
            replSetInitiate: {
                _id: 'rs0',
                members: [
                    {
                        _id: 0,
                        host: `127.0.0.1:${MONGO_PORT}`
                    }
                ]
            }
        });

        console.log('Replica set inicializado.');

    } finally {
        await client.close().catch(() => {});
    }
}

// =========================================================
// Espera al estado PRIMARY
// =========================================================

async function waitForMongoPrimary(timeout = 30000) {
    const start = Date.now();

    while (Date.now() - start < timeout) {
        const client = new MongoClient(
            MONGO_URI,
            { serverSelectionTimeoutMS: 2000 }
        );

        try {
            await client.connect();

            const status = await client.db('admin').command({
                replSetGetStatus: 1
            });

            const primary = status.members?.some(
                member => member.stateStr === 'PRIMARY'
            );

            if (primary) {
                return;
            }

        } catch {
            // MongoDB o el replica set todavía se están iniciando.
        } finally {
            await client.close().catch(() => {});
        }

        await new Promise(resolve => setTimeout(resolve, 500));
    }

    throw new Error(
        'MongoDB no ha alcanzado el estado PRIMARY.'
    );
}

// =========================================================
// Ventana principal
// =========================================================

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

// =========================================================
// Arranque de PsyInvoice
// =========================================================

app.whenReady().then(async () => {
    try {
        if (managesMongo) {
            // Windows: PsyInvoice administra su propio MongoDB.
            await loadDataPath();

            validateDatabasePath();

            await checkMongoPortAvailable();

            await startMongo();

        } else {
            // Mac: utiliza el MongoDB de Homebrew.
            console.log(
                'Utilizando el MongoDB externo de desarrollo.'
            );
        }

        // En ambos sistemas esperamos a que MongoDB responda.
        await waitForMongo();

        // Comprueba e inicializa el replica set.
        await initializeReplicaSetIfNeeded();

        await waitForMongoPrimary();

        // Arranca Express. app.js inicializa la base de datos.
        const backend = await import('../server/src/app.js');

        await backend.startServer();

        stopServer = backend.stopServer;

        // Abre la interfaz.
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

// =========================================================
// Cierre de ventanas
// =========================================================

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// =========================================================
// Cierre ordenado de la aplicación
// =========================================================

app.on('before-quit', (event) => {
    if (isQuitting) {
        return;
    }

    event.preventDefault();
    isQuitting = true;

    shutdown();
});

// =========================================================
// Apagado de Express y MongoDB
// =========================================================

async function shutdown() {
    // Primero cerramos Express.
    try {
        if (stopServer) {
            await stopServer();
            stopServer = null;
        }
    } catch (error) {
        console.error('Error al cerrar Express:', error);
    }

    // Solo apagamos MongoDB si lo hemos arrancado nosotros.
    if (managesMongo && mongoProcess) {
        try {
            const client = new MongoClient(
                MONGO_URI,
                { serverSelectionTimeoutMS: 3000 }
            );

            try {
                await client.connect();

                await client.db('admin').command({
                    shutdown: 1
                });

            } catch (error) {
                console.log(
                    'MongoDB está cerrándose:',
                    error.message
                );
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

        } catch (error) {
            console.error('Error al cerrar MongoDB:', error);
        }
    }

    app.exit(0);
}

// =========================================================
// Reactivación de la aplicación
// =========================================================

app.on('activate', () => {
    if (
        BrowserWindow.getAllWindows().length === 0 &&
        !isQuitting
    ) {
        createWindow().catch(console.error);
    }
});
