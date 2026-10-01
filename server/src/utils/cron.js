import { checkAndSendReminders } from '../services/reminderService.js';

const HORA_EJECUCION = 8;

function msHastaProximaEjecucion() {
    const ahora = new Date();
    const prox = new Date(ahora);
    prox.setHours(HORA_EJECUCION, 0, 0, 0);
    if (prox <= ahora) prox.setDate(prox.getDate() + 1);
    return prox - ahora;
}

export function iniciarCronDiario() {
    setTimeout(function programar() {
        checkAndSendReminders().catch(err =>
            console.error('Error en recordatorio SMS:', err)
        );
        setTimeout(programar, 24 * 60 * 60 * 1000);
    }, msHastaProximaEjecucion());
}
