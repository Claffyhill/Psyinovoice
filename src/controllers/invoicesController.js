import * as invoicesService from '../services/invoicesService.js';

export async function getInvoices(req, res, next) {
    try {
        const { search, status, year, quarter } = req.query;
        const invoices = await invoicesService.listInvoices({ search, status, year, quarter });
        res.json(invoices);
    } catch (err) {
        next(err);
    }
}

export async function createInvoice(req, res, next) {
    try {
        const invoice = await invoicesService.createInvoice(req.body);
        res.status(201).json(invoice);
    } catch (err) {
        next(err);
    }
}

export async function updateInvoiceStatus(req, res, next) {
    try {
        const invoice = await invoicesService.updateInvoiceStatus(req.params.id, req.body.estado);
        res.json(invoice);
    } catch (err) {
        next(err);
    }
}
