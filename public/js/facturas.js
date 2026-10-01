const tablaBody = document.getElementById('tabla-facturas-body');
const inputBuscar = document.getElementById('filtro-buscar');
const selectTrimestre = document.getElementById('filtro-trimestre');
const selectAnio = document.getElementById('filtro-anio');
const btnDescargarTrimestre = document.getElementById('btn-descargar-trimestre');
const mensajeEl = document.getElementById('mensaje');

let temporizadorBusqueda = null;

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

    selectAnio.innerHTML = '<option value="">Todos los años</option>' +
        anios.map((a) => `<option value="${a}">${a}</option>`).join('');
}

function formatearImporte(centimos) {
    return (centimos / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
}

function formatearFecha(fechaIso) {
    const fecha = new Date(fechaIso);
    return fecha.toLocaleDateString('es-ES');
}

function escapeHtml(texto) {
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
}

function renderFacturas(facturas) {
    if (facturas.length === 0) {
        tablaBody.innerHTML = `
            <tr><td colspan="7" class="tabla__vacio">No se han encontrado facturas.</td></tr>
        `;
        return;
    }

    tablaBody.innerHTML = facturas.map((f) => `
        <tr>
            <td>${escapeHtml(f.numero_factura)}</td>
            <td>${formatearFecha(f.fecha)}</td>
            <td>${escapeHtml(f.paciente_nombre)} ${escapeHtml(f.paciente_apellidos)}</td>
            <td>${escapeHtml(f.concepto)}</td>
            <td>${formatearImporte(f.total_centimos)}</td>
            <td>
                <a
                    class="btn btn--secundario btn--pequeno"
                    href="/api/invoices/${f.id}/pdf"
                    aria-label="Descargar PDF de la factura ${escapeHtml(f.numero_factura)}"
                >
                    <span class="material-symbols-outlined">picture_as_pdf</span>
                </a>
            </td>
        </tr>
    `).join('');
}

function obtenerFiltrosActuales() {
    return {
        search: inputBuscar.value.trim(),
        quarter: selectTrimestre.value,
        year: selectAnio.value
    };
}

async function cargarFacturas() {
    try {
        const facturas = await api.getInvoices(obtenerFiltrosActuales());
        renderFacturas(facturas);
    } catch (err) {
        mostrarMensaje(err.message, 'error');
    }
}

function descargarTrimestrePdf() {
    ocultarMensaje();

    const year = selectAnio.value;
    const quarter = selectTrimestre.value;

    if (!year || !quarter) {
        mostrarMensaje('Selecciona un año y un trimestre', 'error');
        return;
    }

    window.location.href = `/api/invoices/quarterly/pdf?year=${encodeURIComponent(year)}&quarter=${encodeURIComponent(quarter)}`;
}

btnDescargarTrimestre.addEventListener('click', descargarTrimestrePdf);

inputBuscar.addEventListener('input', () => {
    clearTimeout(temporizadorBusqueda);
    temporizadorBusqueda = setTimeout(cargarFacturas, 300);
});

selectTrimestre.addEventListener('change', cargarFacturas);
selectAnio.addEventListener('change', cargarFacturas);

poblarSelectorAnios();
cargarFacturas();
