import * as settingsRepository from '../repositories/settingsRepository.js';
import { httpError } from '../utils/httpError.js';

export async function getSettings() {
    const settings = await settingsRepository.getSettings();
    if (!settings) {
        throw httpError(500, 'No se ha encontrado la configuración del profesional');
    }
    return settings;
}

function validarSettings(data) {
    if (!data.nombre || !data.nombre.trim()) {
        throw httpError(400, 'El nombre es obligatorio');
    }
    if (!data.apellidos || !data.apellidos.trim()) {
        throw httpError(400, 'Los apellidos son obligatorios');
    }
    if (!data.concepto_defecto || !data.concepto_defecto.trim()) {
        throw httpError(400, 'El concepto por defecto es obligatorio');
    }
    if (!data.prefijo_factura || !data.prefijo_factura.trim()) {
        throw httpError(400, 'El prefijo de factura es obligatorio');
    }

    const precioDefecto = Number(data.precio_defecto_centimos);
    if (!Number.isInteger(precioDefecto) || precioDefecto <= 0) {
        throw httpError(400, 'El precio por defecto debe ser un número entero de céntimos mayor que 0');
    }

    const siguienteNumero = Number(data.siguiente_numero);
    if (!Number.isInteger(siguienteNumero) || siguienteNumero <= 0) {
        throw httpError(400, 'El siguiente número de factura debe ser un entero positivo');
    }

    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        throw httpError(400, 'El email no tiene un formato válido');
    }
}

export async function updateSettings(data) {
    validarSettings(data);

    const actual = await getSettings();

    const actualizado = await settingsRepository.updateSettings(actual.id, {
        nombre: data.nombre.trim(),
        apellidos: data.apellidos.trim(),
        nif: data.nif ? data.nif.trim() : null,
        direccion: data.direccion ? data.direccion.trim() : null,
        telefono: data.telefono ? data.telefono.trim() : null,
        email: data.email ? data.email.trim() : null,
        numero_colegiada: data.numero_colegiada ? data.numero_colegiada.trim() : null,
        precio_defecto_centimos: Number(data.precio_defecto_centimos),
        concepto_defecto: data.concepto_defecto.trim(),
        prefijo_factura: data.prefijo_factura.trim(),
        siguiente_numero: Number(data.siguiente_numero)
    });

    return actualizado;
}
