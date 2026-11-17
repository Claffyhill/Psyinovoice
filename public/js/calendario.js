const ESTADOS_TEXTO = {
    confirmed: 'Programada',
    completed: 'Realizada',
    cancelled: 'Cancelada',
    no_show: 'No asistió'
};

const formateadorEuros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const formateadorFechaLarga = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
});
const formateadorDiaCorto = new Intl.DateTimeFormat('es-ES', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC'
});

const fechaSeleccionadaEl = document.getElementById('fecha-seleccionada');
const btnDiaAnterior = document.getElementById('btn-dia-anterior');
const btnHoy = document.getElementById('btn-hoy');
const btnDiaSiguiente = document.getElementById('btn-dia-siguiente');
const btnNuevaCita = document.getElementById('btn-nueva-cita');
const mensajeEl = document.getElementById('mensaje');
const tabDiaria = document.getElementById('tab-diaria');
const tabSemanal = document.getElementById('tab-semanal');
const vistaDiaria = document.getElementById('vista-diaria');
const vistaSemanal = document.getElementById('vista-semanal');
const huecosLista = document.getElementById('huecos-lista');
const semanaCabecera = document.getElementById('semana-cabecera');
const semanaCuerpo = document.getElementById('semana-cuerpo');

const modal = document.getElementById('modal-cita');
const modalTitulo = document.getElementById('modal-cita-titulo');
const form = document.getElementById('form-cita');
const btnCancelarCita = document.getElementById('btn-cancelar-cita');
const campoId = document.getElementById('cita-id');
const campoPaciente = document.getElementById('cita-paciente');
const campoFecha = document.getElementById('cita-fecha');
const campoHora = document.getElementById('cita-hora');
const campoImporte = document.getElementById('cita-importe');
const campoEstado = document.getElementById('cita-estado');
const campoNotas = document.getElementById('cita-notas');

let fechaActual = hoyISO();
let vistaActiva = 'semanal';
let ultimosHuecos = [];
let estadoOriginalEdicion = null;

function hoyISO() {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
}

function fechaUTC(fechaIso) {
    const [y, m, d] = fechaIso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
}

function sumarDias(fechaIso, dias) {
    const fecha = fechaUTC(fechaIso);
    fecha.setUTCDate(fecha.getUTCDate() + dias);
    return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}-${String(fecha.getUTCDate()).padStart(2, '0')}`;
}

function euros(centimos) {
    return formateadorEuros.format(centimos / 100);
}

function escapeHtml(texto) {
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
}

function mostrarMensaje(texto, tipo) {
    mensajeEl.textContent = texto;
    mensajeEl.className = `mensaje mensaje--${tipo}`;
    mensajeEl.hidden = false;
}

function ocultarMensaje() {
    mensajeEl.hidden = true;
}

/* ========== Navegación de fecha ========== */

function actualizarCabeceraFecha() {
    fechaSeleccionadaEl.textContent = formateadorFechaLarga.format(fechaUTC(fechaActual));
}

function actualizarEtiquetasNavegacion() {
    const unidad = vistaActiva === 'semanal' ? 'semana' : 'día';
    const unidadAnterior = vistaActiva === 'semanal' ? 'semana anterior' : 'día anterior';
    const unidadSiguiente = vistaActiva === 'semanal' ? 'semana siguiente' : 'día siguiente';

    btnDiaAnterior.setAttribute('aria-label', `Ir a la ${unidadAnterior}`);
    btnDiaSiguiente.setAttribute('aria-label', `Ir al ${unidadSiguiente}`);
    btnDiaAnterior.title = `Ir a la ${unidadAnterior}`;
    btnDiaSiguiente.title = `Ir al ${unidadSiguiente}`;
    btnHoy.title = `Ir a hoy desde la vista ${unidad}`;
}

async function irADia(fechaIso) {
    fechaActual = fechaIso;
    actualizarCabeceraFecha();
    await recargarVistaActiva();
}

function desplazamientoNavegacion() {
    return vistaActiva === 'semanal' ? 7 : 1;
}

btnDiaAnterior.addEventListener('click', () => {
    const desplazamiento = desplazamientoNavegacion();
    irADia(sumarDias(fechaActual, -desplazamiento));
});
btnDiaSiguiente.addEventListener('click', () => {
    const desplazamiento = desplazamientoNavegacion();
    irADia(sumarDias(fechaActual, desplazamiento));
});
btnHoy.addEventListener('click', () => irADia(hoyISO()));

/* ========== Cambio de vista ========== */

function cambiarVista(vista) {
    vistaActiva = vista;
    actualizarEtiquetasNavegacion();
    tabDiaria.classList.toggle('activa', vista === 'diaria');
    tabSemanal.classList.toggle('activa', vista === 'semanal');
    vistaDiaria.hidden = vista !== 'diaria';
    vistaSemanal.hidden = vista !== 'semanal';
    recargarVistaActiva();
}

tabDiaria.addEventListener('click', () => cambiarVista('diaria'));
tabSemanal.addEventListener('click', () => cambiarVista('semanal'));

async function recargarVistaActiva() {
    if (vistaActiva === 'diaria') {
        await cargarVistaDiaria();
    } else {
        await cargarVistaSemanal();
    }
}

/* ========== Vista diaria ========== */

async function cargarVistaDiaria() {
    huecosLista.innerHTML = '<p class="tabla__vacio">Cargando disponibilidad...</p>';
    try {
        ultimosHuecos = await api.getDaySlots(fechaActual);
        renderHuecosLista(ultimosHuecos);
    } catch (err) {
        mostrarMensaje(err.message, 'error');
    }
}

function renderHuecosLista(huecos) {
    if (huecos.length === 0) {
        huecosLista.innerHTML = '<p class="tabla__vacio">Ese día no tiene horario laboral configurado.</p>';
        return;
    }

    huecosLista.innerHTML = huecos.map((hueco) => {
        if (hueco.blocked) {
            return `
                <div class="hueco-fila hueco-fila--bloqueado">
                    <span class="hueco-fila__hora">${hueco.startTime}</span>
                    <div class="hueco-fila__info">No disponible</div>
                </div>
            `;
        }

        if (hueco.appointment) {
            const cita = hueco.appointment;
            return `
                <div class="hueco-fila hueco-fila--ocupado">
                    <span class="hueco-fila__hora">${hueco.startTime}</span>
                    <div class="hueco-fila__info">
                        <strong>${escapeHtml(cita.patientFirstName)} ${escapeHtml(cita.patientLastName)}</strong>
                        <span>${euros(cita.amountCents)}</span>
                        <span class="badge badge--${cita.status}">${ESTADOS_TEXTO[cita.status]}</span>
                        <select class="select-estado" data-cambiar-estado="${cita.id}" aria-label="Cambiar estado de la cita">
                            ${Object.entries(ESTADOS_TEXTO).map(([valor, texto]) => `
                                <option value="${valor}" ${valor === cita.status ? 'selected' : ''}>${texto}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="hueco-fila__acciones">
                        <button type="button" class="btn btn--secundario btn--pequeno" data-editar-cita="${cita.id}">Editar</button>
                    </div>
                </div>
            `;
        }

        return `
            <div class="hueco-fila">
                <span class="hueco-fila__hora">${hueco.startTime}</span>
                <div class="hueco-fila__info">Libre</div>
                <div class="hueco-fila__acciones">
                    <button type="button" class="btn btn--primary btn--pequeno" data-crear-cita="${hueco.startTime}">Crear cita</button>
                </div>
            </div>
        `;
    }).join('');

    huecosLista.querySelectorAll('[data-crear-cita]').forEach((boton) => {
        boton.addEventListener('click', () => abrirModalNuevaCita(fechaActual, boton.dataset.crearCita));
    });

    huecosLista.querySelectorAll('[data-editar-cita]').forEach((boton) => {
        boton.addEventListener('click', () => {
            const id = boton.dataset.editarCita;
            const hueco = ultimosHuecos.find((h) => h.appointment && h.appointment.id === id);
            if (hueco) abrirModalEdicion(hueco.appointment);
        });
    });

    huecosLista.querySelectorAll('[data-cambiar-estado]').forEach((select) => {
        select.addEventListener('change', () => cambiarEstadoRapido(select.dataset.cambiarEstado, select.value));
    });
}

async function cambiarEstadoRapido(id, estado) {
    ocultarMensaje();
    try {
        await api.updateAppointmentStatus(id, estado);
        mostrarMensaje('Estado actualizado correctamente.', 'exito');
        await recargarVistaActiva();
    } catch (err) {
        mostrarMensaje(err.message, 'error');
    }
}

/* ========== Vista semanal ========== */

function inicioDeSemana(fechaIso) {
    const fecha = fechaUTC(fechaIso);
    const diaSemana = fecha.getUTCDay();
    const desplazamiento = diaSemana === 0 ? -6 : 1 - diaSemana;
    fecha.setUTCDate(fecha.getUTCDate() + desplazamiento);
    return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}-${String(fecha.getUTCDate()).padStart(2, '0')}`;
}

async function cargarVistaSemanal() {
    semanaCuerpo.innerHTML = '<div class="semana-cargando">Cargando...</div>';
    try {
        const lunes = inicioDeSemana(fechaActual);
        const dias = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
        const huecosPorDia = await Promise.all(dias.map((dia) => api.getDaySlots(dia)));
        renderSemana(dias, huecosPorDia);
    } catch (err) {
        mostrarMensaje(err.message, 'error');
    }
}

function renderSemana(dias, huecosPorDia) {
    semanaCabecera.innerHTML = '<div class="semana-cabecera__hora">Hora</div>' +
        dias.map((dia) => {
            const fecha = fechaUTC(dia);
            const esHoy = dia === hoyISO();
            const esSeleccionado = dia === fechaActual;
            const clases = [
                'semana-dia',
                esHoy && esSeleccionado ? 'semana-dia--hoy' : '',
                esSeleccionado ? 'semana-dia--seleccionado' : ''
            ].filter(Boolean).join(' ');
            return `<div class="${clases}"${esSeleccionado ? ' aria-current="date"' : ''}>
                <span>${formateadorDiaCorto.format(fecha).split(' ')[0]}</span>
                <strong>${fecha.getUTCDate()}</strong>
            </div>`;
        }).join('');

    const horasUnicas = new Set();
    huecosPorDia.forEach((huecos) => huecos.forEach((h) => horasUnicas.add(h.startTime)));
    const horasOrdenadas = Array.from(horasUnicas).sort();

    if (horasOrdenadas.length === 0) {
        semanaCuerpo.innerHTML = '<div class="semana-vacia">No hay horario laboral configurado esta semana.</div>';
        return;
    }

    semanaCuerpo.innerHTML = horasOrdenadas.map((hora) => {
        const celdas = dias.map((dia, indice) => {
            const hueco = huecosPorDia[indice].find((h) => h.startTime === hora);

            if (!hueco) {
                return '<div class="semana-bloque semana-bloque--vacio"></div>';
            }
            if (hueco.blocked) {
                return `<div class="semana-bloque semana-bloque--bloqueado">
                    <span class="material-symbols-outlined">block</span>
                    <span>No disponible</span>
                </div>`;
            }
            if (hueco.appointment) {
                const cita = hueco.appointment;
                return `<button type="button" class="semana-cita semana-cita--ocupada" data-editar-cita-semana="${cita.id}">
                    <strong>${escapeHtml(cita.patientFirstName)} ${escapeHtml(cita.patientLastName)}</strong>
                    <span>${hora} · ${euros(cita.amountCents)}</span>
                    <small>${ESTADOS_TEXTO[cita.status] || 'Cita'}</small>
                </button>`;
            }
            return `<button type="button" class="semana-bloque semana-bloque--libre" data-crear-cita-semana="${dia}|${hora}">
                <span class="material-symbols-outlined">add</span>
                <span>Disponible</span>
            </button>`;
        }).join('');

        return `<div class="semana-fila">
            <div class="semana-hora">${hora}</div>
            ${celdas}
        </div>`;
    }).join('');

    semanaCuerpo.querySelectorAll('[data-crear-cita-semana]').forEach((celda) => {
        celda.addEventListener('click', () => {
            const [dia, hora] = celda.dataset.crearCitaSemana.split('|');
            abrirModalNuevaCita(dia, hora);
        });
    });

    semanaCuerpo.querySelectorAll('[data-editar-cita-semana]').forEach((boton) => {
        boton.addEventListener('click', () => {
            const id = boton.dataset.editarCitaSemana;
            const hueco = huecosPorDia.flat().find((item) => item.appointment && item.appointment.id === id);
            if (hueco) abrirModalEdicion(hueco.appointment);
        });
    });
}

/* ========== Modal de nueva cita / edición ========== */

async function cargarPacientesEnSelector() {
    const pacientes = await api.getPatients();
    campoPaciente.innerHTML = '<option value="">Selecciona un paciente...</option>' +
        pacientes.map((p) => `<option value="${p.id}">${escapeHtml(p.nombre)} ${escapeHtml(p.apellidos)}</option>`).join('');
}

async function abrirModalNuevaCita(fechaIso, horaInicio) {
    ocultarMensaje();
    modalTitulo.textContent = 'Nueva cita';
    form.reset();
    campoId.value = '';
    estadoOriginalEdicion = null;

    await cargarPacientesEnSelector();
    campoFecha.value = fechaIso;
    campoHora.value = horaInicio || '';

    try {
        const settings = await api.getSettings();
        campoImporte.value = (settings.precio_defecto_centimos / 100).toFixed(2);
    } catch (err) {
        campoImporte.value = '';
    }

    campoEstado.value = 'scheduled';
    modal.hidden = false;
}

async function abrirModalEdicion(cita) {
    ocultarMensaje();
    modalTitulo.textContent = 'Editar cita';
    form.reset();
    campoId.value = cita.id;
    estadoOriginalEdicion = cita.status;

    await cargarPacientesEnSelector();
    campoPaciente.value = cita.patientId;

    const fechaIso = cita.appointmentDate.slice(0, 10);
    campoFecha.value = fechaIso;
    campoHora.value = cita.startTime.slice(0, 5);

    campoImporte.value = (cita.amountCents / 100).toFixed(2);
    campoEstado.value = cita.status;
    campoNotas.value = cita.administrativeNotes || '';

    modal.hidden = false;
}

function cerrarModal() {
    modal.hidden = true;
}

btnNuevaCita.addEventListener('click', () => abrirModalNuevaCita(fechaActual));
btnCancelarCita.addEventListener('click', cerrarModal);

async function manejarEnvioFormulario(evento) {
    evento.preventDefault();
    ocultarMensaje();

    const datos = {
        patientId: campoPaciente.value,
        appointmentDate: campoFecha.value,
        startTime: campoHora.value,
        amountCents: Math.round(Number(campoImporte.value) * 100),
        administrativeNotes: campoNotas.value.trim()
    };

    try {
        if (campoId.value) {
            await api.updateAppointment(campoId.value, datos);
            if (campoEstado.value !== estadoOriginalEdicion) {
                await api.updateAppointmentStatus(campoId.value, campoEstado.value);
            }
            mostrarMensaje('Cita actualizada correctamente.', 'exito');
        } else {
            datos.status = campoEstado.value;
            await api.createAppointment(datos);
            mostrarMensaje('Cita creada correctamente.', 'exito');
        }

        cerrarModal();
        await recargarVistaActiva();
    } catch (err) {
        mostrarMensaje(err.message, 'error');
    }
}

form.addEventListener('submit', manejarEnvioFormulario);

/* ========== Inicialización ========== */

actualizarEtiquetasNavegacion();
actualizarCabeceraFecha();
tabDiaria.classList.remove('activa');
tabSemanal.classList.add('activa');
vistaDiaria.hidden = true;
vistaSemanal.hidden = false;
cargarVistaSemanal();
