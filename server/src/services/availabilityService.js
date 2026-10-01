import * as availabilityRepository from '../repositories/availabilityRepository.js';
import * as appointmentsRepository from '../repositories/appointmentsRepository.js';
import { generarHuecos, normalizarHora, rangosSeSolapan, calcularHoraFin, horaMenorQue } from '../utils/timeSlots.js';
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

            const cita = citas.find((c) =>
                rangosSeSolapan(hueco.startTime, hueco.endTime, normalizarHora(c.startTime), normalizarHora(c.endTime))
            );
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
 * Comprueba que el intervalo [horaInicio, horaInicio+45min) de una fecha
 * concreta:
 *   - quede COMPLETAMENTE dentro de alguna ventana de weekly_availability
 *     de ese día de la semana (no exige que coincida con un hueco exacto
 *     de la rejilla de 45 min; permite horas manuales como las 12:00
 *     aunque la rejilla estándar marque 12:15 como inicio de hueco);
 *   - no esté bloqueada por un availability_block (día completo o rango
 *     concreto que se solape).
 * No comprueba solapamiento con otras citas (eso se hace de forma atómica
 * en la transacción de creación/edición, en existsActiveAt).
 */
export async function assertHoraValida(fecha, horaInicio) {
    const horaNormalizada = normalizarHora(horaInicio);
    const horaFin = calcularHoraFin(horaNormalizada);

    const diaSemana = diaDeLaSemana(fecha);
    const ventanas = await availabilityRepository.findWeeklyAvailabilityByDay(diaSemana);

    const dentroDeAlgunaVentana = ventanas.some((ventana) => {
        const inicioVentana = normalizarHora(ventana.start_time);
        const finVentana = normalizarHora(ventana.end_time);
        return !horaMenorQue(horaNormalizada, inicioVentana) && !horaMenorQue(finVentana, horaFin);
    });

    if (!dentroDeAlgunaVentana) {
        throw httpError(400, 'Esa hora no forma parte del horario laboral de ese día');
    }

    const bloqueos = await availabilityRepository.findBlocksByDate(fecha);
    const bloqueoDiaCompleto = bloqueos.some((b) => !b.start_time || !b.end_time);
    const bloqueado = bloqueoDiaCompleto || bloqueos.some((b) =>
        b.start_time && b.end_time &&
        rangosSeSolapan(horaNormalizada, horaFin, normalizarHora(b.start_time), normalizarHora(b.end_time))
    );

    if (bloqueado) {
        throw httpError(400, 'Ese día u horario está bloqueado');
    }

    return { startTime: horaNormalizada, endTime: horaFin };
}
