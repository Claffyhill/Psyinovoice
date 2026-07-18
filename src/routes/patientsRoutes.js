import { Router } from 'express';
import * as patientsController from '../controllers/patientsController.js';

export const patientsRouter = Router();

patientsRouter.get('/', patientsController.getPatients);
patientsRouter.get('/:id', patientsController.getPatientById);
patientsRouter.post('/', patientsController.createPatient);
patientsRouter.put('/:id', patientsController.updatePatient);
