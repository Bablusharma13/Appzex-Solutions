import { Router } from 'express';
import * as superAdminController from '../controllers/superAdminController';
import { authenticate } from '../middleware/authenticate';
import { requireSuperAdmin } from '../middleware/authorize';
import { notFoundHandler } from '../middleware/errorHandler';

/** Platform administration. SUPER_ADMIN only; agency users and clients get 403. */
export const superAdminRoutes = Router();

superAdminRoutes.use(authenticate, requireSuperAdmin);

superAdminRoutes.get('/dashboard', superAdminController.dashboard);
superAdminRoutes.get('/agencies', superAdminController.listAgencies);
superAdminRoutes.post('/agencies', superAdminController.createAgency);
superAdminRoutes.get('/agencies/:id', superAdminController.getAgency);
superAdminRoutes.patch('/agencies/:id/status', superAdminController.updateAgencyStatus);
superAdminRoutes.post('/agencies/:id/support-session', superAdminController.startSupportSession);
superAdminRoutes.post('/support-session/:id/end', superAdminController.endSupportSession);
superAdminRoutes.use(notFoundHandler);
