import * as appointmentsService from '../services/appointmentsService.js';

export async function getAppointments(req, res, next) {
    try {
        const { date, dateFrom, dateTo, patientId, status } = req.query;
        const appointments = await appointmentsService.listAppointments({ date, dateFrom, dateTo, patientId, status });
        res.json(appointments);
    } catch (err) {
        next(err);
    }
}

<<<<<<< HEAD
=======
export async function getAppointmentById(req, res, next) {
    try {
        const appointment = await appointmentsService.getAppointment(req.params.id);
        res.json(appointment);
    } catch (err) {
        next(err);
    }
}

>>>>>>> 3d2b9cc (v. calendario bdd)
export async function createAppointment(req, res, next) {
    try {
        const appointment = await appointmentsService.createAppointment(req.body);
        res.status(201).json(appointment);
    } catch (err) {
        next(err);
    }
}

export async function updateAppointment(req, res, next) {
    try {
        const appointment = await appointmentsService.updateAppointment(req.params.id, req.body);
        res.json(appointment);
    } catch (err) {
        next(err);
    }
}

<<<<<<< HEAD
=======
export async function rescheduleAppointment(req, res, next) {
    try {
        const appointment = await appointmentsService.rescheduleAppointment(req.params.id, req.body);
        res.json(appointment);
    } catch (err) {
        next(err);
    }
}

>>>>>>> 3d2b9cc (v. calendario bdd)
export async function updateAppointmentStatus(req, res, next) {
    try {
        const appointment = await appointmentsService.updateAppointmentStatus(req.params.id, req.body.status);
        res.json(appointment);
    } catch (err) {
        next(err);
    }
}

export async function getBillingSummary(req, res, next) {
    try {
        const resumen = await appointmentsService.getBillingSummary(req.query.year, req.query.month);
        res.json(resumen);
    } catch (err) {
        next(err);
    }
}
<<<<<<< HEAD
=======

export async function getPendingBillingSummary(req, res, next) {
    try {
        const resumen = await appointmentsService.getPendingBillingSummary(req.query.year, req.query.month);
        res.json(resumen);
    } catch (err) {
        next(err);
    }
}
>>>>>>> 3d2b9cc (v. calendario bdd)
