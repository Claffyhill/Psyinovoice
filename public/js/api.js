const BASE_URL = '/api';

async function request(path, options = {}) {
    const response = await fetch(`${BASE_URL}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
        const mensaje = data && data.error ? data.error : 'Error de comunicación con el servidor';
        throw new Error(mensaje);
    }

    return data;
}

async function descargarPdfTrimestral(year, quarter) {
    const response = await fetch(
        `${BASE_URL}/invoices/quarterly/pdf?year=${encodeURIComponent(year)}&quarter=${encodeURIComponent(quarter)}`,
        { headers: { Accept: 'application/pdf, application/json' } }
    );

    if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data && data.error ? data.error : 'No se ha podido generar el informe.');
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `PsyInvoice-${year}-T${quarter}.pdf`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);
}

const api = {
    getPatients(search) {
        const query = search ? `?search=${encodeURIComponent(search)}` : '';
        return request(`/patients${query}`);
    },
    createPatient(patient) {
        return request('/patients', {
            method: 'POST',
            body: JSON.stringify(patient)
        });
    },
    updatePatient(id, patient) {
        return request(`/patients/${id}`, {
            method: 'PUT',
            body: JSON.stringify(patient)
        });
    },
    getSettings() {
        return request('/settings');
    },
    updateSettings(settings) {
        return request('/settings', {
            method: 'PUT',
            body: JSON.stringify(settings)
        });
    },
    getInvoices(filters = {}) {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([clave, valor]) => {
            if (valor) params.set(clave, valor);
        });
        const query = params.toString() ? `?${params.toString()}` : '';
        return request(`/invoices${query}`);
    },
    descargarPdfTrimestral,
    createInvoice(invoice) {
        return request('/invoices', {
            method: 'POST',
            body: JSON.stringify(invoice)
        });
    },
    createMonthlyInvoice(patientId, year, month) {
        return request('/invoices/monthly', {
            method: 'POST',
            body: JSON.stringify({ patientId, year, month })
        });
    },
    getPendingBillingSummary(year, month) {
        return request(`/appointments/pending-summary?year=${encodeURIComponent(year)}&month=${encodeURIComponent(month)}`);
    },
    getAppointments(filters = {}) {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([clave, valor]) => {
            if (valor) params.set(clave, valor);
        });
        const query = params.toString() ? `?${params.toString()}` : '';
        return request(`/appointments${query}`);
    },
    getAppointment(id) {
        return request(`/appointments/${id}`);
    },
    createAppointment(appointment) {
        return request('/appointments', {
            method: 'POST',
            body: JSON.stringify(appointment)
        });
    },
    updateAppointment(id, appointment) {
        return request(`/appointments/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(appointment)
        });
    },
    rescheduleAppointment(id, appointmentDate, startTime) {
        return request(`/appointments/${id}/reschedule`, {
            method: 'PATCH',
            body: JSON.stringify({ appointmentDate, startTime })
        });
    },
    updateAppointmentStatus(id, status) {
        return request(`/appointments/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
        });
    },
    getDaySlots(date) {
        return request(`/availability/slots?date=${encodeURIComponent(date)}`);
    },
    getBillingSummary(year, month) {
        return request(`/appointments/billing-summary?year=${encodeURIComponent(year)}&month=${encodeURIComponent(month)}`);
    }
};
