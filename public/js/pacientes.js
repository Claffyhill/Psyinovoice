const tablaBody = document.getElementById('tabla-pacientes-body');
const inputBuscar = document.getElementById('input-buscar');
const mensajeEl = document.getElementById('mensaje');

const modal = document.getElementById('modal-paciente');
const modalTitulo = document.getElementById('modal-titulo');
const form = document.getElementById('form-paciente');
const btnNuevoPaciente = document.getElementById('btn-nuevo-paciente');
const btnCancelar = document.getElementById('btn-cancelar');

const campoId = document.getElementById('paciente-id');
const campoNombre = document.getElementById('paciente-nombre');
const campoApellidos = document.getElementById('paciente-apellidos');
const campoDni = document.getElementById('paciente-dni');
const campoTelefono = document.getElementById('paciente-telefono');
const campoEmail = document.getElementById('paciente-email');
const campoDireccion = document.getElementById('paciente-direccion');
const campoFechaNacimiento = document.getElementById('paciente-fecha-nacimiento');

let temporizadorBusqueda = null;

function mostrarMensaje(texto, tipo) {
    mensajeEl.textContent = texto;
    mensajeEl.className = `mensaje mensaje--${tipo}`;
    mensajeEl.hidden = false;
}

function ocultarMensaje() {
    mensajeEl.hidden = true;
}

function renderPacientes(pacientes) {
    if (pacientes.length === 0) {
        tablaBody.innerHTML = `
            <tr><td colspan="7" class="tabla__vacio">No se han encontrado pacientes.</td></tr>
        `;
        return;
    }

    tablaBody.innerHTML = pacientes.map((p) => `
        <tr>
            <td>${escapeHtml(p.nombre)}</td>
            <td>${escapeHtml(p.apellidos)}</td>
            <td>${escapeHtml(p.dni || '-')}</td>
            <td>${formatearFecha(p.fecha_nacimiento)}</td>
            <td>${escapeHtml(p.telefono || '-')}</td>
            <td>${escapeHtml(p.email || '-')}</td>
            <td>
                <button class="btn btn--secundario btn--pequeno" data-editar="${p.id}">Editar</button>
            </td>
        </tr>
    `).join('');

    tablaBody.querySelectorAll('[data-editar]').forEach((boton) => {
        boton.addEventListener('click', () => abrirModalEdicion(pacientes, boton.dataset.editar));
    });
}

function formatearFecha(fechaIso) {
    if (!fechaIso) return '-';
    const fecha = new Date(fechaIso);
    return fecha.toLocaleDateString('es-ES', { timeZone: 'UTC' });
}

function escapeHtml(texto) {
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
}

async function cargarPacientes(search) {
    try {
        const pacientes = await api.getPatients(search);
        renderPacientes(pacientes);
    } catch (err) {
        mostrarMensaje(err.message, 'error');
    }
}

function abrirModalNuevo() {
    modalTitulo.textContent = 'Nuevo paciente';
    form.reset();
    campoId.value = '';
    modal.hidden = false;
    campoNombre.focus();
}

function abrirModalEdicion(pacientes, id) {
    const paciente = pacientes.find((p) => String(p.id) === String(id));
    if (!paciente) return;

    modalTitulo.textContent = 'Editar paciente';
    campoId.value = paciente.id;
    campoNombre.value = paciente.nombre;
    campoApellidos.value = paciente.apellidos;
    campoDni.value = paciente.dni || '';
    campoTelefono.value = paciente.telefono || '';
    campoEmail.value = paciente.email || '';
    campoDireccion.value = paciente.direccion || '';
    campoFechaNacimiento.value = paciente.fecha_nacimiento ? paciente.fecha_nacimiento.slice(0, 10) : '';
    modal.hidden = false;
    campoNombre.focus();
}

function cerrarModal() {
    modal.hidden = true;
}

async function manejarEnvioFormulario(evento) {
    evento.preventDefault();
    ocultarMensaje();

    const datos = {
        nombre: campoNombre.value.trim(),
        apellidos: campoApellidos.value.trim(),
        dni: campoDni.value.trim(),
        telefono: campoTelefono.value.trim(),
        email: campoEmail.value.trim(),
        direccion: campoDireccion.value.trim(),
        fecha_nacimiento: campoFechaNacimiento.value
    };

    try {
        if (campoId.value) {
            await api.updatePatient(campoId.value, datos);
            mostrarMensaje('Paciente actualizado correctamente.', 'exito');
        } else {
            await api.createPatient(datos);
            mostrarMensaje('Paciente creado correctamente.', 'exito');
        }
        cerrarModal();
        await cargarPacientes(inputBuscar.value.trim());
    } catch (err) {
        mostrarMensaje(err.message, 'error');
    }
}

btnNuevoPaciente.addEventListener('click', abrirModalNuevo);
btnCancelar.addEventListener('click', cerrarModal);
form.addEventListener('submit', manejarEnvioFormulario);

inputBuscar.addEventListener('input', () => {
    clearTimeout(temporizadorBusqueda);
    temporizadorBusqueda = setTimeout(() => {
        cargarPacientes(inputBuscar.value.trim());
    }, 300);
});

cargarPacientes();
