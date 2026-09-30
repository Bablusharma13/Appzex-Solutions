import { Router } from 'express';
import * as fileController from '../controllers/fileController';
import { authenticate } from '../middleware/authenticate';
import { authRoutes } from './authRoutes';
import { portalRoutes } from './portalRoutes';
import { superAdminRoutes } from './superAdminRoutes';
import { workspaceRoutes } from './workspaceRoutes';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', time: new Date().toISOString() } });
});

apiRouter.use('/auth', authRoutes);
apiRouter.use('/super-admin', superAdminRoutes);
apiRouter.use('/portal', portalRoutes);

// Shared by agency users and clients; authorization is role-aware in the service.
apiRouter.get('/files/:id', authenticate, fileController.download);

apiRouter.use('/', workspaceRoutes);
