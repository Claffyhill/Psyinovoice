const selectAnio = document.getElementById('informe-anio');
const selectTrimestre = document.getElementById('informe-trimestre');
const btnDescargar = document.getElementById('btn-descargar-informe');
const mensajeEl = document.getElementById('mensaje');

const selectResumenAnio = document.getElementById('resumen-anio');
const selectResumenMes = document.getElementById('resumen-mes');
const btnConsultarResumen = document.getElementById('btn-consultar-resumen');
const resumenBody = document.getElementById('resumen-mensual-body');

const formateadorEuros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

function mostrarMensaje(texto, tipo) {
    mensajeEl.textContent = texto;
    mensajeEl.className = `mensaje mensaje--${tipo}`;
    mensajeEl.hidden = false;
}

function ocultarMensaje() {
    mensajeEl.hidden = true;
}

function poblarSelectorAnios() {
    const anioActual = new Date().getFullYear();
    const anios = [anioActual, anioActual - 1, anioActual - 2];

    selectAnio.innerHTML = anios.map((a) => `<option value="${a}">${a}</option>`).join('');
    selectResumenAnio.innerHTML = anios.map((a) => `<option value="${a}">${a}</option>`).join('');
    selectResumenMes.value = String(new Date().getMonth() + 1);
}

function descargarInforme() {
    ocultarMensaje();

    const year = selectAnio.value;
    const quarter = selectTrimestre.value;

    if (!year || !quarter) {
        mostrarMensaje('Selecciona un año y un trimestre', 'error');
        return;
    }

    window.location.href = `/api/invoices/quarterly/pdf?year=${encodeURIComponent(year)}&quarter=${encodeURIComponent(quarter)}`;
}

function escapeHtml(texto) {
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
}

async function consultarResumenMensual() {
    ocultarMensaje();
    resumenBody.innerHTML = '<tr><td colspan="4" class="tabla__vacio">Cargando...</td></tr>';

    try {
        const resumen = await api.getBillingSummary(selectResumenAnio.value, selectResumenMes.value);

        if (resumen.length === 0) {
            resumenBody.innerHTML = '<tr><td colspan="4" class="tabla__vacio">No hay sesiones realizadas ese mes.</td></tr>';
            return;
        }

        resumenBody.innerHTML = resumen.map((grupo) => `
            <tr>
                <td>${escapeHtml(grupo.patientName)}</td>
                <td>${grupo.sessionCount}</td>
                <td>${formateadorEuros.format(grupo.totalCents / 100)}</td>
                <td>
                    <span class="badge ${grupo.alreadyInvoiced ? 'badge--pagada' : 'badge--pendiente'}">
                        ${grupo.alreadyInvoiced ? 'Ya facturado' : 'Sin facturar'}
                    </span>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        mostrarMensaje(err.message, 'error');
        resumenBody.innerHTML = '<tr><td colspan="4" class="tabla__vacio">No se ha podido cargar el resumen.</td></tr>';
    }
}

btnDescargar.addEventListener('click', descargarInforme);
btnConsultarResumen.addEventListener('click', consultarResumenMensual);

poblarSelectorAnios();
