# PsyInvoice

Aplicación de escritorio para la gestión de pacientes, citas y facturación
de profesionales de la psicología.

## Funcionalidades

- Dashboard con resumen de actividad.
- Gestión de pacientes.
- Calendario diario y semanal.
- Creación, edición y cambio de estado de citas.
- Generación de facturas en PDF.
- Búsqueda y filtrado de facturas.
- Informes trimestrales en PDF.
- Resumen mensual de sesiones.
- Configuración de datos profesionales y preferencias de facturación.
- Interfaz de escritorio Electron con controles de ventana personalizados.
- Ventana maximizada manteniendo visible la barra de tareas de Windows.

## Tecnologías

- Electron
- Node.js
- Express
- MongoDB
- JavaScript
- HTML y CSS
- PDFKit

## Requisitos

- Node.js 18 o superior.
- npm.
- MongoDB:
  - En Windows, la aplicación utiliza el ejecutable incluido en
    `resources/mongodb`.
  - En macOS y desarrollo externo, MongoDB debe estar instalado y ejecutándose
    en `127.0.0.1:27017`.

MongoDB debe ejecutarse como replica set, aunque solo tenga un nodo, porque
la numeración de facturas utiliza transacciones multi-documento.

## Instalación

Desde la raíz del proyecto:

```bash
npm install
cd server
npm install
cd ..
```

En Windows, comprueba que exista el ejecutable:

```text
resources/mongodb/bin/mongod.exe
```

## Configuración de MongoDB

El backend admite estas variables opcionales en `server/.env`:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/?directConnection=true
MONGODB_DB_NAME=psyinvoice
PORT=3000
```

Si no se especifican, se utilizan esos valores por defecto.

Para una instalación manual de MongoDB:

```bash
mongod --replSet rs0 --dbpath /ruta/a/tus/datos
```

En otra terminal, inicializa el replica set una sola vez:

```bash
mongosh --eval "rs.initiate()"
```

Después, inicializa la base de datos, los índices, la configuración inicial y
el horario semanal:

```bash
cd server
npm run db:init
```

## Ejecución en desarrollo

Para iniciar la aplicación Electron:

```bash
npm start
```

El proceso principal inicia el backend y abre la interfaz en Electron.

Para iniciar solo el backend:

```bash
cd server
npm start
```

Durante el desarrollo del backend, puedes usar:

```bash
cd server
npm run dev
```

## Crear el instalador de Windows

Desde la raíz del proyecto:

```bash
npm run dist
```

El instalador se genera en la carpeta `dist` con el nombre:

```text
PsyInvoice-Setup-<versión>.exe
```

## Datos de la aplicación

En Windows, PsyInvoice crea y administra su propia carpeta de datos
`PsyInvoiceData`, que contiene:

- Base de datos local de MongoDB.
- Registros de MongoDB.
- Carpeta de copias de seguridad.

La ubicación de datos se selecciona durante el primer arranque y se guarda en
la configuración local de Electron.

No elimines la carpeta de datos si necesitas conservar pacientes, citas o
facturas.

## Estructura principal

```text
electron/       Proceso principal y preload de Electron
public/         Interfaz web: páginas, estilos y scripts
server/src/     API Express, servicios y repositorios
resources/      Recursos incluidos, incluido MongoDB para Windows
build/          Recursos de compilación, como el icono
dist/           Instaladores generados
```

## Licencia

Este proyecto utiliza la licencia ISC definida en `server/package.json`.
