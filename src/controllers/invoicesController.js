import * as invoicesService from '../services/invoicesService.js';
import * as invoicePdfService from '../services/invoicePdfService.js';
import { sanitizeFilename } from '../utils/sanitizeFilename.js';

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

export async function downloadInvoicePdf(req, res, next) {
    try {
        const { invoice, settings } = await invoicePdfService.getInvoiceForPdf(req.params.id);
        const doc = invoicePdfService.buildInvoicePdfDocument(invoice, settings);

        const nombreArchivo = `${sanitizeFilename(invoice.numero_factura)}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);

        doc.pipe(res);
    } catch (err) {
        next(err);
    }
}

export async function downloadQuarterlyPdf(req, res, next) {
    try {
        const { invoices, settings, year, quarter } = await invoicePdfService.getQuarterlyInvoicesForPdf(
            req.query.year,
            req.query.quarter
        );
        const doc = invoicePdfService.buildQuarterlyPdfDocument(invoices, settings, year, quarter);

        const nombreArchivo = sanitizeFilename(`PsyInvoice-${year}-T${quarter}`) + '.pdf';

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);

        doc.pipe(res);
    } catch (err) {
        next(err);
    }
}
