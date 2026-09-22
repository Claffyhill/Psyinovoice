const saludoEl = document.getElementById('home-saludo');
const fechaEl = document.getElementById('home-fecha');
const mensajeEl = document.getElementById('mensaje');
const tablaRecientesBody = document.getElementById('home-tabla-recientes');
const statFacturas = document.getElementById('home-stat-facturas');
const statTotal = document.getElementById('home-stat-total');
const btnInformeTrimestre = document.getElementById('home-btn-informe-trimestre');

const formateadorEuros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const formateadorFecha = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
const formateadorFechaCompleta = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
});

function mostrarMensaje(texto, tipo) {
    mensajeEl.textContent = texto;
    mensajeEl.className = `mensaje mensaje--${tipo}`;
    mensajeEl.hidden = false;
}

function euros(centimos) {
    return formateadorEuros.format(centimos / 100);
}

function escapeHtml(texto) {
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
}

function trimestreActual() {
    const hoy = new Date();
    return {
        year: hoy.getFullYear(),
        quarter: Math.ceil((hoy.getMonth() + 1) / 3)
    };
}

async function mostrarSaludoYFecha() {
    const hoy = new Date();
    const hora = hoy.getHours();
    const momento = hora < 12 ? 'Buenos días' : hora < 20 ? 'Buenas tardes' : 'Buenas noches';

    let nombre = '';
    try {
        const settings = await api.getSettings();
        nombre = settings.nombre ? `, ${settings.nombre}` : '';
    } catch (err) {
        nombre = '';
    }

    saludoEl.textContent = `${momento}${nombre}`;
    fechaEl.textContent = formateadorFechaCompleta.format(hoy);
}

function renderPacientesRecientes(invoices) {
    const vistos = new Set();
    const recientes = [];

    for (const factura of invoices) {
        if (vistos.has(factura.patient_id)) continue;
        vistos.add(factura.patient_id);
        recientes.push(factura);
        if (recientes.length === 5) break;
    }

    if (recientes.length === 0) {
        tablaRecientesBody.innerHTML = `
            <tr><td colspan="5" class="tabla__vacio">Todavía no hay pacientes facturados.</td></tr>
        `;
        return;
    }

    tablaRecientesBody.innerHTML = recientes.map((f) => `
        <tr>
            <td>${escapeHtml(f.paciente_nombre)} ${escapeHtml(f.paciente_apellidos)}</td>
            <td>${formateadorFecha.format(new Date(f.fecha))}</td>
            <td>${euros(f.total_centimos)}</td>
            <td>
                <a class="btn btn--secundario btn--pequeno" href="/pages/nueva-factura.html?patient_id=${f.patient_id}">
                    Facturar
                </a>
            </td>
            <td>
                <a class="btn btn--secundario btn--pequeno" href="/pages/pacientes.html">
                    Editar
                </a>
            </td>
        </tr>
    `).join('');
}

function renderResumenTrimestre(invoices) {
    const { year, quarter } = trimestreActual();

    const delTrimestre = invoices.filter((f) => {
        const fecha = new Date(f.fecha);
        const trimestreFactura = Math.ceil((fecha.getUTCMonth() + 1) / 3);
        return fecha.getUTCFullYear() === year && trimestreFactura === quarter;
    });

    const totalFacturado = delTrimestre.reduce((suma, f) => suma + f.total_centimos, 0);

    statFacturas.textContent = delTrimestre.length;
    statTotal.textContent = euros(totalFacturado);

    btnInformeTrimestre.href = `/api/invoices/quarterly/pdf?year=${year}&quarter=${quarter}`;
}

async function cargarDatos() {
    try {
        const invoices = await api.getInvoices();
        renderPacientesRecientes(invoices);
        renderResumenTrimestre(invoices);
    } catch (err) {
        mostrarMensaje(err.message, 'error');
    }
}

mostrarSaludoYFecha();
cargarDatos();
