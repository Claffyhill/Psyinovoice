const campoPaciente = document.getElementById('factura-paciente');
const campoPacienteId = document.getElementById('factura-paciente-id');
const listaPacientes = document.getElementById('factura-pacientes-lista');
const campoFecha = document.getElementById('factura-fecha');
const campoConcepto = document.getElementById('factura-concepto');
const campoImporte = document.getElementById('factura-importe');
const campoObservaciones = document.getElementById('factura-observaciones');
const form = document.getElementById('form-factura');
const mensajeEl = document.getElementById('mensaje');
let pacientesDisponibles = [];

function mostrarMensaje(texto, tipo) {
    mensajeEl.textContent = texto;
    mensajeEl.className = `mensaje mensaje--${tipo}`;
    mensajeEl.hidden = false;
}

function ocultarMensaje() {
    mensajeEl.hidden = true;
}

function hoyEnFormatoInput() {
    const hoy = new Date();
    const anio = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
}

async function cargarPacientesEnSelector() {
    pacientesDisponibles = await api.getPatients();

    const idDesdeUrl = new URLSearchParams(window.location.search).get('patient_id');
    const pacienteInicial = pacientesDisponibles.find((p) => p.id === idDesdeUrl);

    if (pacienteInicial) {
        seleccionarPaciente(pacienteInicial);
    }
}

function mostrarOpcionesPacientes() {
    const termino = campoPaciente.value.trim().toLocaleLowerCase('es');
    const coincidencias = pacientesDisponibles.filter((paciente) => (
        `${paciente.nombre} ${paciente.apellidos}`.toLocaleLowerCase('es').includes(termino)
    ));

    listaPacientes.innerHTML = coincidencias.length > 0
        ? coincidencias.map((paciente) => `
            <button type="button" class="selector-buscable__opcion" role="option" data-paciente-id="${paciente.id}">
                ${escapeHtml(`${paciente.nombre} ${paciente.apellidos}`)}
            </button>
        `).join('')
        : '<span class="selector-buscable__vacio">No se encontraron pacientes.</span>';

    listaPacientes.hidden = false;
    campoPaciente.setAttribute('aria-expanded', 'true');
}

function ocultarOpcionesPacientes() {
    listaPacientes.hidden = true;
    campoPaciente.setAttribute('aria-expanded', 'false');
}

function seleccionarPaciente(paciente) {
    campoPaciente.value = `${paciente.nombre} ${paciente.apellidos}`;
    campoPacienteId.value = paciente.id;
    ocultarOpcionesPacientes();
}

function escapeHtml(texto) {
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
}

async function cargarValoresPorDefecto() {
    const settings = await api.getSettings();

    campoConcepto.value = settings.concepto_defecto;
    campoImporte.value = (settings.precio_defecto_centimos / 100).toFixed(2);
}

async function inicializar() {
    campoFecha.value = hoyEnFormatoInput();

    try {
        await Promise.all([cargarPacientesEnSelector(), cargarValoresPorDefecto()]);
    } catch (err) {
        mostrarMensaje(err.message, 'error');
    }
}

function restablecerFormularioParaSiguienteFactura() {
    campoPaciente.value = '';
    campoPacienteId.value = '';
    campoObservaciones.value = '';
    campoFecha.value = hoyEnFormatoInput();
    campoPaciente.focus();
}

async function manejarEnvioFormulario(evento) {
    evento.preventDefault();
    ocultarMensaje();

    if (!campoPacienteId.value) {
        mostrarMensaje('Selecciona un paciente de la lista.', 'error');
        campoPaciente.focus();
        mostrarOpcionesPacientes();
        return;
    }

    const importeEnEuros = Number(campoImporte.value);
    const importeCentimos = Math.round(importeEnEuros * 100);

    const factura = {
        patient_id: campoPacienteId.value,
        fecha: campoFecha.value,
        concepto: campoConcepto.value.trim(),
        importe_centimos: importeCentimos,
        observaciones: campoObservaciones.value.trim()
    };

    try {
        const facturaCreada = await api.createInvoice(factura);
        mostrarMensaje(`Factura ${facturaCreada.numero_factura} generada correctamente.`, 'exito');
        restablecerFormularioParaSiguienteFactura();
        await cargarValoresPorDefecto();
    } catch (err) {
        mostrarMensaje(err.message, 'error');
    }
}

campoPaciente.addEventListener('input', () => {
    campoPacienteId.value = '';
    mostrarOpcionesPacientes();
});

campoPaciente.addEventListener('focus', mostrarOpcionesPacientes);

listaPacientes.addEventListener('click', (evento) => {
    const opcion = evento.target.closest('[data-paciente-id]');
    if (!opcion) return;

    const paciente = pacientesDisponibles.find((item) => item.id === opcion.dataset.pacienteId);
    if (paciente) seleccionarPaciente(paciente);
});

document.addEventListener('click', (evento) => {
    if (!evento.target.closest('.selector-buscable')) {
        ocultarOpcionesPacientes();
    }
});

form.addEventListener('submit', manejarEnvioFormulario);

inicializar();
