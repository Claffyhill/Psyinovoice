export function sanitizeFilename(texto) {
    return texto.replace(/[^a-zA-Z0-9-_]/g, '_');
}
