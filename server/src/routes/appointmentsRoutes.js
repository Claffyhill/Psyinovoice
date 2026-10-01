import { Router } from 'express';
import * as appointmentsController from '../controllers/appointmentsController.js';

export const appointmentsRouter = Router();

appointmentsRouter.get('/billing-summary', appointmentsController.getBillingSummary);
appointmentsRouter.get('/pending-summary', appointmentsController.getPendingBillingSummary);
appointmentsRouter.get('/', appointmentsController.getAppointments);
appointmentsRouter.get('/:id', appointmentsController.getAppointmentById);
appointmentsRouter.post('/', appointmentsController.createAppointment);
appointmentsRouter.patch('/:id/status', appointmentsController.updateAppointmentStatus);
appointmentsRouter.patch('/:id/reschedule', appointmentsController.rescheduleAppointment);
appointmentsRouter.patch('/:id', appointmentsController.updateAppointment);
