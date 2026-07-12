import * as settingsRepository from '../repositories/settingsRepository.js';
import { httpError } from '../utils/httpError.js';

export async function getSettings() {
    const settings = await settingsRepository.getSettings();
    if (!settings) {
        throw httpError(500, 'No se ha encontrado la configuración del profesional');
    }
    return settings;
}
