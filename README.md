# PsyInvoice

Aplicación de gestión y facturación para psicólogos autónomos.

## Tecnologías

- HTML
- CSS
- JavaScript
- Node.js
- Express
- MongoDB

## Base de datos

La app usa el driver nativo `mongodb` (sin ORM, consistente con el resto
del proyecto) y transacciones multi-documento para la numeración atómica
de facturas, así que MongoDB debe correr como replica set (vale un
despliegue de un solo nodo):

```bash
# Arrancar mongod con el replica set habilitado (una sola vez por instalación)
mongod --replSet rs0 --dbpath /ruta/a/tus/datos

# En otra terminal, inicializar el replica set (una sola vez)
mongosh --eval "rs.initiate()"

# Crear índices y sembrar la configuración inicial + horario semanal
cd server && npm run db:init
```

La cadena de conexión y el nombre de la base de datos se configuran en
`server/.env` (`MONGODB_URI`, `MONGODB_DB_NAME`).

## Funcionalidades

- Gestión de pacientes
- Emisión de facturas
- Configuración profesional
- Dashboard
- Resumen trimestral (en desarrollo)

## Estado

🚧 En desarrollo.

## Próximas funcionalidades

- PDF
- Electron
- Copias de seguridad