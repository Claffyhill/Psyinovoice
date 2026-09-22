import { getDb } from '../config/database.js';

export async function findWeeklyAvailabilityByDay(dayOfWeek) {
    return getDb().collection('weekly_availability')
        .find({ day_of_week: dayOfWeek, active: true })
        .sort({ start_time: 1 })
        .toArray();
}

export async function findAllWeeklyAvailability() {
    return getDb().collection('weekly_availability')
        .find({})
        .sort({ day_of_week: 1, start_time: 1 })
        .toArray();
}

export async function findBlocksByDate(date) {
    // NULLS FIRST de Postgres: los bloqueos de día completo (sin start_time)
    // primero, igual que antes.
    return getDb().collection('availability_blocks')
        .find({ block_date: date })
        .sort({ start_time: 1 })
        .toArray();
}
