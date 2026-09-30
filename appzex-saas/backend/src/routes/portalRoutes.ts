import { Router } from 'express';
import * as portalController from '../controllers/portalController';
import { authenticate } from '../middleware/authenticate';
import { requireClientAccess } from '../middleware/authorize';
import { notFoundHandler } from '../middleware/errorHandler';
import { singleFileUpload } from '../middleware/upload';

/** Client portal. CLIENT users only; everything is scoped to their client company. */
export const portalRoutes = Router();

portalRoutes.use(authenticate, requireClientAccess);

portalRoutes.get('/dashboard', portalController.dashboard);
portalRoutes.get('/projects', portalController.listProjects);
portalRoutes.get('/projects/:id', portalController.getProject);
portalRoutes.post('/projects/:projectId/feedback', portalController.createFeedback);
portalRoutes.post('/projects/:projectId/files', singleFileUpload, portalController.uploadFile);
portalRoutes.get('/feedback', portalController.listFeedback);
portalRoutes.get('/feedback/:id', portalController.getFeedback);
portalRoutes.post('/feedback/:id/comments', portalController.addFeedbackComment);
portalRoutes.get('/meetings', portalController.listMeetings);
portalRoutes.get('/files', portalController.listFiles);
portalRoutes.use(notFoundHandler);
