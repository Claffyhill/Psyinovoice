export function errorHandler(err, req, res, next) {
    console.error(err);

    if (err.code === '23505') {
        return res.status(409).json({ error: 'Ya existe un registro con ese valor único (por ejemplo, el DNI).' });
    }

    if (err.status) {
        return res.status(err.status).json({ error: err.message });
    }

    res.status(500).json({ error: 'Error interno del servidor' });
}

export function notFoundHandler(req, res) {
    res.status(404).json({ error: 'Ruta no encontrada' });
}
