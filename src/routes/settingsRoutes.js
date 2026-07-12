import { Router } from 'express';
import * as settingsController from '../controllers/settingsController.js';

export const settingsRouter = Router();

settingsRouter.get('/', settingsController.getSettings);
