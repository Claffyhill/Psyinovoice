const form = document.getElementById('form-configuracion');
const mensajeEl = document.getElementById('mensaje');
const btnGuardar = document.getElementById('btn-guardar-configuracion');

const campoNombre = document.getElementById('cfg-nombre');
const campoApellidos = document.getElementById('cfg-apellidos');
const campoNif = document.getElementById('cfg-nif');
const campoDireccion = document.getElementById('cfg-direccion');
const campoTelefono = document.getElementById('cfg-telefono');
const campoEmail = document.getElementById('cfg-email');
const campoNumeroColegiada = document.getElementById('cfg-numero-colegiada');
const campoPrecioDefecto = document.getElementById('cfg-precio-defecto');
const campoPrefijoFactura = document.getElementById('cfg-prefijo-factura');
const campoConceptoDefecto = document.getElementById('cfg-concepto-defecto');
const campoSiguienteNumero = document.getElementById('cfg-siguiente-numero');

function mostrarMensaje(texto, tipo) {
    mensajeEl.textContent = texto;
    mensajeEl.className = `mensaje mensaje--${tipo}`;
    mensajeEl.hidden = false;
}

function ocultarMensaje() {
    mensajeEl.hidden = true;
}

function rellenarFormulario(settings) {
    campoNombre.value = settings.nombre || '';
    campoApellidos.value = settings.apellidos || '';
    campoNif.value = settings.nif || '';
    campoDireccion.value = settings.direccion || '';
    campoTelefono.value = settings.telefono || '';
    campoEmail.value = settings.email || '';
    campoNumeroColegiada.value = settings.numero_colegiada || '';
    campoPrecioDefecto.value = (settings.precio_defecto_centimos / 100).toFixed(2);
    campoPrefijoFactura.value = settings.prefijo_factura || '';
    campoConceptoDefecto.value = settings.concepto_defecto || '';
    campoSiguienteNumero.value = settings.siguiente_numero;
}

async function cargarConfiguracion() {
    try {
        const settings = await api.getSettings();
        rellenarFormulario(settings);
    } catch (err) {
        mostrarMensaje(err.message, 'error');
    }
}

async function manejarEnvioFormulario(evento) {
    evento.preventDefault();
    ocultarMensaje();

    const datos = {
        nombre: campoNombre.value.trim(),
        apellidos: campoApellidos.value.trim(),
        nif: campoNif.value.trim(),
        direccion: campoDireccion.value.trim(),
        telefono: campoTelefono.value.trim(),
        email: campoEmail.value.trim(),
        numero_colegiada: campoNumeroColegiada.value.trim(),
        precio_defecto_centimos: Math.round(Number(campoPrecioDefecto.value) * 100),
        prefijo_factura: campoPrefijoFactura.value.trim(),
        concepto_defecto: campoConceptoDefecto.value.trim(),
        siguiente_numero: Number(campoSiguienteNumero.value)
    };

    btnGuardar.disabled = true;

    try {
        const actualizado = await api.updateSettings(datos);
        rellenarFormulario(actualizado);
        mostrarMensaje('Cambios guardados correctamente.', 'exito');
    } catch (err) {
        mostrarMensaje(err.message, 'error');
    } finally {
        btnGuardar.disabled = false;
    }
}

form.addEventListener('submit', manejarEnvioFormulario);

cargarConfiguracion();
