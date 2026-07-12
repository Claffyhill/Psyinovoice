import { Router } from 'express';
import { patientsRouter } from './patientsRoutes.js';
import { invoicesRouter } from './invoicesRoutes.js';
import { settingsRouter } from './settingsRoutes.js';

export const apiRouter = Router();

apiRouter.use('/patients', patientsRouter);
apiRouter.use('/invoices', invoicesRouter);
apiRouter.use('/settings', settingsRouter);
