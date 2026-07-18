export function formatInvoiceNumber(prefijo, numero, anio) {
    const numeroConCeros = String(numero).padStart(4, '0');
    return `${prefijo}-${anio}-${numeroConCeros}`;
}
