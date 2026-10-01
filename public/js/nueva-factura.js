const selectPaciente = document.getElementById('factura-paciente');
const campoFecha = document.getElementById('factura-fecha');
const campoConcepto = document.getElementById('factura-concepto');
const campoImporte = document.getElementById('factura-importe');
const campoObservaciones = document.getElementById('factura-observaciones');
const form = document.getElementById('form-factura');
const mensajeEl = document.getElementById('mensaje');

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
    const pacientes = await api.getPatients();

    selectPaciente.innerHTML = '<option value="">Selecciona un paciente...</option>' +
        pacientes.map((p) => `<option value="${p.id}">${p.nombre} ${p.apellidos}</option>`).join('');

    const idDesdeUrl = new URLSearchParams(window.location.search).get('patient_id');
    if (idDesdeUrl) {
        selectPaciente.value = idDesdeUrl;
    }
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
    selectPaciente.value = '';
    campoObservaciones.value = '';
    campoFecha.value = hoyEnFormatoInput();
    selectPaciente.focus();
}

async function manejarEnvioFormulario(evento) {
    evento.preventDefault();
    ocultarMensaje();

    const importeEnEuros = Number(campoImporte.value);
    const importeCentimos = Math.round(importeEnEuros * 100);

    const factura = {
        patient_id: selectPaciente.value,
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

form.addEventListener('submit', manejarEnvioFormulario);

inicializar();
