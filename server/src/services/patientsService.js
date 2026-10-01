import * as patientsRepository from '../repositories/patientsRepository.js';
import { httpError } from '../utils/httpError.js';

function validatePatientData(data) {
    if (!data.nombre || !data.nombre.trim()) {
        throw httpError(400, 'El nombre es obligatorio');
    }
    if (!data.apellidos || !data.apellidos.trim()) {
        throw httpError(400, 'Los apellidos son obligatorios');
    }
    if (!data.telefono || !data.telefono.trim()) {
        throw httpError(400, 'El teléfono es obligatorio');
    }
    if (!data.direccion || !data.direccion.trim()) {
        throw httpError(400, 'La dirección es obligatoria');
    }

    // La fecha de nacimiento es obligatoria, pero NO se exige mayoría de edad:
    // solo se valida que exista, tenga formato correcto y no sea futura.
    if (!data.fecha_nacimiento || !/^\d{4}-\d{2}-\d{2}$/.test(data.fecha_nacimiento)) {
        throw httpError(400, 'La fecha de nacimiento es obligatoria');
    }

    const fecha = new Date(data.fecha_nacimiento);
    if (Number.isNaN(fecha.getTime())) {
        throw httpError(400, 'La fecha de nacimiento no es válida');
    }
    if (fecha.getTime() > Date.now()) {
        throw httpError(400, 'La fecha de nacimiento no puede ser futura');
    }
}

export async function listPatients(search) {
    return patientsRepository.findAll(search);
}

export async function getPatient(id) {
    const patient = await patientsRepository.findById(id);
    if (!patient) {
        throw httpError(404, 'Paciente no encontrado');
    }
    return patient;
}

export async function createPatient(data) {
    validatePatientData(data);
    return patientsRepository.create(data);
}

export async function updatePatient(id, data) {
    validatePatientData(data);

    const updated = await patientsRepository.update(id, data);
    if (!updated) {
        throw httpError(404, 'Paciente no encontrado');
    }
    return updated;
}

export async function countPatients() {
    return patientsRepository.count();
}
