import * as patientsRepository from '../repositories/patientsRepository.js';
import { httpError } from '../utils/httpError.js';

function validatePatientData(data) {
    if (!data.nombre || !data.nombre.trim()) {
        throw httpError(400, 'El nombre es obligatorio');
    }
    if (!data.apellidos || !data.apellidos.trim()) {
        throw httpError(400, 'Los apellidos son obligatorios');
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
