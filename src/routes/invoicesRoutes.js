import { Router } from 'express';
import * as invoicesController from '../controllers/invoicesController.js';

export const invoicesRouter = Router();

invoicesRouter.get('/', invoicesController.getInvoices);
invoicesRouter.post('/', invoicesController.createInvoice);
invoicesRouter.patch('/:id/status', invoicesController.updateInvoiceStatus);
invoicesRouter.get('/quarterly/pdf', invoicesController.downloadQuarterlyPdf);
invoicesRouter.get('/:id/pdf', invoicesController.downloadInvoicePdf);
