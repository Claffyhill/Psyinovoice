import { Router } from 'express';
import * as appointmentsController from '../controllers/appointmentsController.js';

export const appointmentsRouter = Router();

appointmentsRouter.get('/billing-summary', appointmentsController.getBillingSummary);
appointmentsRouter.get('/', appointmentsController.getAppointments);
appointmentsRouter.post('/', appointmentsController.createAppointment);
appointmentsRouter.patch('/:id/status', appointmentsController.updateAppointmentStatus);
appointmentsRouter.patch('/:id', appointmentsController.updateAppointment);
