const DURACION_CITA_MINUTOS = 45;

function aMinutos(horaTexto) {
    const [horas, minutos] = horaTexto.split(':').map(Number);
    return horas * 60 + minutos;
}

function aTextoHora(minutosTotales) {
    const horas = Math.floor(minutosTotales / 60) % 24;
    const minutos = minutosTotales % 60;
    return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;
}

/**
 * Normaliza una hora que puede venir como "09:15" o "09:15:00" (formato TIME de PostgreSQL)
 * a "HH:MM".
 */
export function normalizarHora(horaTexto) {
    return horaTexto.slice(0, 5);
}

export function sumarMinutos(horaTexto, minutos) {
    return aTextoHora(aMinutos(normalizarHora(horaTexto)) + minutos);
}

export function calcularHoraFin(horaInicio) {
    return sumarMinutos(horaInicio, DURACION_CITA_MINUTOS);
}

export function horaMenorQue(horaA, horaB) {
    return aMinutos(normalizarHora(horaA)) < aMinutos(normalizarHora(horaB));
}

export function rangosSeSolapan(inicioA, finA, inicioB, finB) {
    return aMinutos(normalizarHora(inicioA)) < aMinutos(normalizarHora(finB)) &&
        aMinutos(normalizarHora(inicioB)) < aMinutos(normalizarHora(finA));
}

/**
 * Genera los huecos de 45 minutos entre horaInicio y horaFin (excluida),
 * ambos en formato "HH:MM" o "HH:MM:SS".
 */
export function generarHuecos(horaInicio, horaFin) {
    const inicio = aMinutos(normalizarHora(horaInicio));
    const fin = aMinutos(normalizarHora(horaFin));
    const huecos = [];

    for (let cursor = inicio; cursor + DURACION_CITA_MINUTOS <= fin; cursor += DURACION_CITA_MINUTOS) {
        huecos.push({
            startTime: aTextoHora(cursor),
            endTime: aTextoHora(cursor + DURACION_CITA_MINUTOS)
        });
    }

    return huecos;
}

export { DURACION_CITA_MINUTOS };
