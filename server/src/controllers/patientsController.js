import * as patientsService from '../services/patientsService.js';

export async function getPatients(req, res, next) {
    try {
        const { search } = req.query;
        const patients = await patientsService.listPatients(search);
        res.json(patients);
    } catch (err) {
        next(err);
    }
}

export async function getPatientById(req, res, next) {
    try {
        const patient = await patientsService.getPatient(req.params.id);
        res.json(patient);
    } catch (err) {
        next(err);
    }
}

export async function createPatient(req, res, next) {
    try {
        const patient = await patientsService.createPatient(req.body);
        res.status(201).json(patient);
    } catch (err) {
        next(err);
    }
}

export async function updatePatient(req, res, next) {
    try {
        const patient = await patientsService.updatePatient(req.params.id, req.body);
        res.json(patient);
    } catch (err) {
        next(err);
    }
}
