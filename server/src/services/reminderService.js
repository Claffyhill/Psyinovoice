import { sql } from '../config/database.js';
import * as patientsRepository from '../repositories/patientsRepository.js';
import * as settingsService from './settingsService.js';
import { sendSms } from './smsService.js';

export async function checkAndSendReminders() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const fechaStr = tomorrow.toISOString().slice(0, 10);

    const rows = await sql`
        SELECT a.id, a.patient_id, a.appointment_date, a.start_time
        FROM appointments a
        WHERE a.appointment_date = ${fechaStr}
          AND a.status IN ('scheduled', 'confirmed')
    `;

    if (rows.length === 0) return;

    const settings = await settingsService.getSettings();
    const profesional = `${settings.nombre} ${settings.apellidos}`;

    for (const cita of rows) {
        const patient = await patientsRepository.findById(cita.patient_id);
        if (!patient?.telefono) continue;

        const fechaFormateada = new Date(cita.appointment_date + 'T12:00:00')
            .toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
        const hora = cita.start_time.slice(0, 5);
        const mensaje = `Hola ${patient.nombre}, te recordamos tu cita con ${profesional} mañana ${fechaFormateada} a las ${hora}.`;

        await sendSms(patient.telefono, mensaje);
    }
}
