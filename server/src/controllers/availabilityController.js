import * as availabilityService from '../services/availabilityService.js';

export async function getDaySlots(req, res, next) {
    try {
        const slots = await availabilityService.getDaySlots(req.query.date);
        res.json(slots);
    } catch (err) {
        next(err);
    }
}
