import * as availabilityRepository from '../repositories/availabilityRepository.js';
import * as appointmentsRepository from '../repositories/appointmentsRepository.js';
import { generarHuecos, normalizarHora, rangosSeSolapan } from '../utils/timeSlots.js';
import { httpError } from '../utils/httpError.js';

function diaDeLaSemana(fechaTexto) {
    // fechaTexto viene como "YYYY-MM-DD"; se interpreta en UTC para evitar
    // desplazamientos de zona horaria al calcular el día de la semana.
    const [anio, mes, dia] = fechaTexto.split('-').map(Number);
    return new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
}

function validarFecha(fecha) {
    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(new Date(fecha).getTime())) {
        throw httpError(400, 'La fecha debe tener el formato AAAA-MM-DD');
    }
}

/**
 * Genera todos los huecos de 45 minutos de un día según el horario semanal,
 * marcando cada uno como libre, ocupado por una cita o bloqueado.
 */
export async function getDaySlots(fecha) {
    validarFecha(fecha);

    const diaSemana = diaDeLaSemana(fecha);
    const ventanas = await availabilityRepository.findWeeklyAvailabilityByDay(diaSemana);

    const huecos = ventanas.flatMap((ventana) => generarHuecos(ventana.start_time, ventana.end_time));

    const bloqueos = await availabilityRepository.findBlocksByDate(fecha);
    const citas = await appointmentsRepository.findActiveByDate(fecha);

    const bloqueoDiaCompleto = bloqueos.some((b) => !b.start_time || !b.end_time);

    return huecos
        .sort((a, b) => (a.startTime < b.startTime ? -1 : 1))
        .map((hueco) => {
            const bloqueado = bloqueoDiaCompleto || bloqueos.some((b) =>
                b.start_time && b.end_time &&
                rangosSeSolapan(hueco.startTime, hueco.endTime, normalizarHora(b.start_time), normalizarHora(b.end_time))
            );

            if (bloqueado) {
                return { startTime: hueco.startTime, endTime: hueco.endTime, available: false, blocked: true };
            }

            const cita = citas.find((c) => normalizarHora(c.startTime) === hueco.startTime);
            if (cita) {
                return {
                    startTime: hueco.startTime,
                    endTime: hueco.endTime,
                    available: false,
                    blocked: false,
                    appointment: cita
                };
            }

            return { startTime: hueco.startTime, endTime: hueco.endTime, available: true, blocked: false };
        });
}

/**
 * Comprueba que una hora de inicio pertenezca a un hueco válido del horario
 * semanal para esa fecha y que no esté bloqueada. No comprueba citas ya
 * existentes (eso se hace de forma atómica en la transacción de creación).
 */
export async function assertHoraValida(fecha, horaInicio) {
    const slots = await getDaySlots(fecha);
    const hueco = slots.find((s) => s.startTime === normalizarHora(horaInicio));

    if (!hueco) {
        throw httpError(400, 'Esa hora no forma parte del horario laboral de ese día');
    }
    if (hueco.blocked) {
        throw httpError(400, 'Ese día u horario está bloqueado');
    }

    return hueco;
}
