import { pool } from '../config/database.js';

export async function findWeeklyAvailabilityByDay(dayOfWeek) {
    const { rows } = await pool.query(
        `SELECT id, day_of_week, start_time, end_time
         FROM weekly_availability
         WHERE day_of_week = $1 AND active = true
         ORDER BY start_time`,
        [dayOfWeek]
    );
    return rows;
}

export async function findAllWeeklyAvailability() {
    const { rows } = await pool.query(
        `SELECT id, day_of_week, start_time, end_time, active
         FROM weekly_availability
         ORDER BY day_of_week, start_time`
    );
    return rows;
}

export async function findBlocksByDate(date) {
    const { rows } = await pool.query(
        `SELECT id, block_date, start_time, end_time, reason
         FROM availability_blocks
         WHERE block_date = $1
         ORDER BY start_time NULLS FIRST`,
        [date]
    );
    return rows;
}
