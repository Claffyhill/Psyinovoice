import { Router } from 'express';
import { patientsRouter } from './patientsRoutes.js';
import { invoicesRouter } from './invoicesRoutes.js';
import { settingsRouter } from './settingsRoutes.js';
import { appointmentsRouter } from './appointmentsRoutes.js';
import { availabilityRouter } from './availabilityRoutes.js';

export const apiRouter = Router();

apiRouter.use('/patients', patientsRouter);
apiRouter.use('/invoices', invoicesRouter);
apiRouter.use('/settings', settingsRouter);
apiRouter.use('/appointments', appointmentsRouter);
apiRouter.use('/availability', availabilityRouter);
