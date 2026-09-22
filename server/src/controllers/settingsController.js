import * as settingsService from '../services/settingsService.js';

export async function getSettings(req, res, next) {
    try {
        const settings = await settingsService.getSettings();
        res.json(settings);
    } catch (err) {
        next(err);
    }
}

export async function updateSettings(req, res, next) {
    try {
        const settings = await settingsService.updateSettings(req.body);
        res.json(settings);
    } catch (err) {
        next(err);
    }
}
