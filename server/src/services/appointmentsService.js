import { withTransaction } from '../config/database.js';
import * as appointmentsRepository from '../repositories/appointmentsRepository.js';
import * as patientsRepository from '../repositories/patientsRepository.js';
import * as availabilityService from './availabilityService.js';
import * as settingsService from './settingsService.js';
import { calcularHoraFin, normalizarHora } from '../utils/timeSlots.js';
import { httpError } from '../utils/httpError.js';

const ESTADOS_VALIDOS = ['scheduled', 'completed', 'cancelled', 'no_show'];

function validarFecha(fecha) {
    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(new Date(fecha).getTime())) {
        throw httpError(400, 'La fecha no es válida');
    }
}

function validarHora(hora) {
    if (!hora || !/^\d{2}:\d{2}$/.test(hora)) {
        throw httpError(400, 'La hora debe tener el formato HH:MM');
    }
}

async function validarDatosComunes(data) {
    if (!data.patientId) {
        throw httpError(400, 'Debes seleccionar un paciente');
    }

    const patient = await patientsRepository.findById(data.patientId);
    if (!patient) {
        throw httpError(400, 'El paciente seleccionado no existe');
    }

    validarFecha(data.appointmentDate);
    validarHora(data.startTime);

    const amountCents = Number(data.amountCents);
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
        throw httpError(400, 'El importe debe ser un número entero de céntimos mayor que 0');
    }

    return { patient, amountCents };
}

export async function listAppointments(filters) {
    if (filters.status && !ESTADOS_VALIDOS.includes(filters.status)) {
        throw httpError(400, 'El estado indicado no es válido');
    }
    return appointmentsRepository.findAll(filters);
}

export async function getAppointment(id) {
    const cita = await appointmentsRepository.findById(id);
    if (!cita) {
        throw httpError(404, 'Cita no encontrada');
    }
    return cita;
}

export async function createAppointment(data) {
    if (data.amountCents === undefined || data.amountCents === null || data.amountCents === '') {
        data.amountCents = await getDefaultAmountCents();
    }

    const { amountCents } = await validarDatosComunes(data);

    const estado = data.status || 'scheduled';
    if (!ESTADOS_VALIDOS.includes(estado)) {
        throw httpError(400, 'El estado indicado no es válido');
    }

    await availabilityService.assertHoraValida(data.appointmentDate, data.startTime);

    const startTime = normalizarHora(data.startTime);
    const endTime = calcularHoraFin(startTime);

    const id = await withTransaction(async (session) => {
        const ocupado = await appointmentsRepository.existsActiveAt(session, data.appointmentDate, startTime, endTime);
        if (ocupado) {
            throw httpError(409, 'Ese horario ya está ocupado. Elige otro hueco libre.');
        }

        return appointmentsRepository.create({
            patientId: data.patientId,
            appointmentDate: data.appointmentDate,
            startTime,
            endTime,
            status: estado,
            amountCents,
            bookingSource: 'admin',
            administrativeNotes: data.administrativeNotes
        }, session);
    });

    return appointmentsRepository.findById(id);
}

export async function updateAppointment(id, data) {
    const existente = await getAppointment(id);
    const { amountCents } = await validarDatosComunes(data);

    await availabilityService.assertHoraValida(data.appointmentDate, data.startTime);

    const startTime = normalizarHora(data.startTime);
    const endTime = calcularHoraFin(startTime);

    await withTransaction(async (session) => {
        const ocupado = await appointmentsRepository.existsActiveAt(session, data.appointmentDate, startTime, endTime, existente.id);
        if (ocupado) {
            throw httpError(409, 'Ese horario ya está ocupado. Elige otro hueco libre.');
        }
    });

    const actualizada = await appointmentsRepository.update(id, {
        patientId: data.patientId,
        appointmentDate: data.appointmentDate,
        startTime,
        endTime,
        amountCents,
        administrativeNotes: data.administrativeNotes
    });

    if (!actualizada) {
        throw httpError(404, 'Cita no encontrada');
    }

    return appointmentsRepository.findById(id);
}

export async function updateAppointmentStatus(id, status) {
    if (!ESTADOS_VALIDOS.includes(status)) {
        throw httpError(400, 'El estado indicado no es válido');
    }

    const actualizada = await appointmentsRepository.updateStatus(id, status);
    if (!actualizada) {
        throw httpError(404, 'Cita no encontrada');
    }

    return appointmentsRepository.findById(id);
}

/**
 * Reprograma una cita: cambia fecha y/u hora conservando paciente, importe
 * y notas actuales. Reutiliza updateAppointment, que ya revalida toda la
 * disponibilidad (horario semanal, bloqueos y solapamientos) para la nueva
 * fecha/hora antes de guardar.
 */
export async function rescheduleAppointment(id, data) {
    validarFecha(data.appointmentDate);
    validarHora(data.startTime);

    const existente = await getAppointment(id);

    return updateAppointment(id, {
        patientId: existente.patientId,
        appointmentDate: data.appointmentDate,
        startTime: data.startTime,
        amountCents: existente.amountCents,
        administrativeNotes: existente.administrativeNotes
    });
}

export async function getDefaultAmountCents() {
    const settings = await settingsService.getSettings();
    return settings.precio_defecto_centimos;
}

const MES_MINIMO = 1;
const MES_MAXIMO = 12;
const ANIO_MINIMO = 2000;
const ANIO_MAXIMO = 2100;

export async function getBillingSummary(yearParam, monthParam) {
    const year = Number(yearParam);
    const month = Number(monthParam);

    if (!yearParam || !Number.isInteger(year) || year < ANIO_MINIMO || year > ANIO_MAXIMO) {
        throw httpError(400, `El año debe ser un número entero entre ${ANIO_MINIMO} y ${ANIO_MAXIMO}`);
    }
    if (!monthParam || !Number.isInteger(month) || month < MES_MINIMO || month > MES_MAXIMO) {
        throw httpError(400, 'El mes debe ser un número entero entre 1 y 12');
    }

    const grupos = await appointmentsRepository.findCompletedGroupedByMonth(year, month);

    return grupos.map((grupo) => ({
        patientId: grupo.patientId,
        patientName: `${grupo.patientFirstName} ${grupo.patientLastName}`,
        sessionCount: grupo.sessionCount,
        totalCents: grupo.totalCents,
        appointmentIds: grupo.appointmentIds,
        alreadyInvoiced: grupo.alreadyInvoiced
    }));
}

function validarAnioMes(yearParam, monthParam) {
    const year = Number(yearParam);
    const month = Number(monthParam);

    if (!yearParam || !Number.isInteger(year) || year < ANIO_MINIMO || year > ANIO_MAXIMO) {
        throw httpError(400, `El año debe ser un número entero entre ${ANIO_MINIMO} y ${ANIO_MAXIMO}`);
    }
    if (!monthParam || !Number.isInteger(month) || month < MES_MINIMO || month > MES_MAXIMO) {
        throw httpError(400, 'El mes debe ser un número entero entre 1 y 12');
    }

    return { year, month };
}

/**
 * Sesiones realizadas y todavía NO facturadas de un mes, agrupadas por
 * paciente. A diferencia de getBillingSummary, aquí lo ya facturado no
 * aparece en absoluto (no solo se marca), porque esta vista alimenta la
 * pantalla de "facturación pendiente".
 */
export async function getPendingBillingSummary(yearParam, monthParam) {
    const { year, month } = validarAnioMes(yearParam, monthParam);

    const grupos = await appointmentsRepository.findPendingGroupedByMonth(year, month);

    return grupos.map((grupo) => ({
        patientId: grupo.patientId,
        patientName: `${grupo.patientFirstName} ${grupo.patientLastName}`,
        sessionCount: grupo.sessionCount,
        totalCents: grupo.totalCents,
        appointmentIds: grupo.appointmentIds,
        appointmentDates: grupo.appointmentDates
    }));
}
