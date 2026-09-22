async function cargarProfesionalEnSidebar() {
    const nombreEl = document.getElementById('sidebar-nombre-profesional');
    const avatarEl = document.getElementById('sidebar-avatar-iniciales');

    if (!nombreEl || !avatarEl) return;

    try {
        const settings = await api.getSettings();
        const nombreCompleto = `${settings.nombre || ''} ${settings.apellidos || ''}`.trim();
        nombreEl.textContent = nombreCompleto || 'Profesional';

        const inicialNombre = (settings.nombre || '?').charAt(0);
        const inicialApellido = (settings.apellidos || '').charAt(0);
        avatarEl.textContent = (inicialNombre + inicialApellido).toUpperCase();
    } catch (err) {
        nombreEl.textContent = 'Profesional';
    }
}

cargarProfesionalEnSidebar();
