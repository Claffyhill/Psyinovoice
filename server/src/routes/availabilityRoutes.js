import { Router } from 'express';
import * as availabilityController from '../controllers/availabilityController.js';

export const availabilityRouter = Router();

availabilityRouter.get('/slots', availabilityController.getDaySlots);
