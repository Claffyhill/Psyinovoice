import { Router } from 'express';
import * as invoicesController from '../controllers/invoicesController.js';

export const invoicesRouter = Router();

invoicesRouter.get('/', invoicesController.getInvoices);
<<<<<<< HEAD
=======
invoicesRouter.post('/monthly', invoicesController.createMonthlyInvoice);
>>>>>>> 3d2b9cc (v. calendario bdd)
invoicesRouter.post('/', invoicesController.createInvoice);
invoicesRouter.patch('/:id/status', invoicesController.updateInvoiceStatus);
invoicesRouter.get('/quarterly/pdf', invoicesController.downloadQuarterlyPdf);
invoicesRouter.get('/:id/pdf', invoicesController.downloadInvoicePdf);
