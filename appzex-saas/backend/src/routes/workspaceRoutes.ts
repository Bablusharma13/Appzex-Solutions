import { Router } from 'express';
import * as agencyController from '../controllers/agencyController';
import * as aiController from '../controllers/aiController';
import * as clientController from '../controllers/clientController';
import * as feedbackController from '../controllers/feedbackController';
import * as fileController from '../controllers/fileController';
import * as meetingController from '../controllers/meetingController';
import * as milestoneController from '../controllers/milestoneController';
import * as projectController from '../controllers/projectController';
import * as taskController from '../controllers/taskController';
import { authenticate } from '../middleware/authenticate';
import { requireAgencyAccess, requireAgencyAdmin } from '../middleware/authorize';
import { aiRateLimiter } from '../middleware/rateLimit';
import { singleFileUpload } from '../middleware/upload';

/**
 * Agency workspace API. Every route requires an agency user (or a super admin
 * in read-only support mode). CLIENT users receive 403 for all of these.
 * Tenant scoping happens in the services using req.auth.agencyId.
 */
export const workspaceRoutes = Router();

workspaceRoutes.use(authenticate, requireAgencyAccess);

// Workspace, settings, team, activity
workspaceRoutes.get('/dashboard', agencyController.dashboard);
workspaceRoutes.get('/agency', agencyController.getSettings);
workspaceRoutes.patch('/agency', requireAgencyAdmin, agencyController.updateSettings);
workspaceRoutes.get('/team', agencyController.listTeam);
workspaceRoutes.post('/team', requireAgencyAdmin, agencyController.createTeamMember);
workspaceRoutes.get('/activity', agencyController.listActivity);

// Clients (writes are admin-only)
workspaceRoutes.get('/clients', clientController.list);
workspaceRoutes.post('/clients', requireAgencyAdmin, clientController.create);
workspaceRoutes.get('/clients/:id', clientController.get);
workspaceRoutes.patch('/clients/:id', requireAgencyAdmin, clientController.update);
workspaceRoutes.delete('/clients/:id', requireAgencyAdmin, clientController.remove);
workspaceRoutes.get('/clients/:id/activity', clientController.activity);
workspaceRoutes.post('/clients/:id/portal-users', requireAgencyAdmin, clientController.createPortalUser);

// Projects
workspaceRoutes.get('/projects', projectController.list);
workspaceRoutes.post('/projects', projectController.create);
workspaceRoutes.get('/projects/:id', projectController.get);
workspaceRoutes.patch('/projects/:id', projectController.update);
workspaceRoutes.delete('/projects/:id', requireAgencyAdmin, projectController.remove);
workspaceRoutes.get('/projects/:id/health', projectController.health);
workspaceRoutes.get('/projects/:id/activity', projectController.activity);

// Milestones
workspaceRoutes.get('/projects/:projectId/milestones', milestoneController.listForProject);
workspaceRoutes.post('/projects/:projectId/milestones', milestoneController.create);
workspaceRoutes.patch('/milestones/:id', milestoneController.update);
workspaceRoutes.delete('/milestones/:id', milestoneController.remove);

// Tasks + comments
workspaceRoutes.get('/tasks', taskController.list);
workspaceRoutes.get('/tasks/summary', taskController.summary);
workspaceRoutes.get('/tasks/:id', taskController.get);
workspaceRoutes.patch('/tasks/:id', taskController.update);
workspaceRoutes.delete('/tasks/:id', taskController.remove);
workspaceRoutes.get('/tasks/:taskId/comments', taskController.listComments);
workspaceRoutes.post('/tasks/:taskId/comments', taskController.addComment);
workspaceRoutes.get('/projects/:projectId/tasks', taskController.listForProject);
workspaceRoutes.post('/projects/:projectId/tasks', taskController.create);

// Meetings
workspaceRoutes.get('/meetings', meetingController.list);
workspaceRoutes.get('/projects/:projectId/meetings', meetingController.listForProject);
workspaceRoutes.post('/projects/:projectId/meetings', meetingController.create);
workspaceRoutes.patch('/meetings/:id', meetingController.update);
workspaceRoutes.delete('/meetings/:id', meetingController.remove);

// Feedback
workspaceRoutes.get('/feedback', feedbackController.list);
workspaceRoutes.get('/projects/:projectId/feedback', feedbackController.listForProject);
workspaceRoutes.post('/projects/:projectId/feedback', feedbackController.create);
workspaceRoutes.get('/feedback/:id', feedbackController.get);
workspaceRoutes.patch('/feedback/:id', feedbackController.updateStatus);
workspaceRoutes.post('/feedback/:id/comments', feedbackController.addComment);

// Files (download is mounted separately because clients use it too)
workspaceRoutes.get('/files', fileController.list);
workspaceRoutes.get('/projects/:projectId/files', fileController.listForProject);
workspaceRoutes.post('/projects/:projectId/files', singleFileUpload, fileController.upload);
workspaceRoutes.patch('/files/:id', fileController.update);
workspaceRoutes.delete('/files/:id', fileController.remove);

// AI (read-only analysis; never writes project data)
workspaceRoutes.get('/ai/status', aiController.status);
workspaceRoutes.post('/ai/project-health', aiRateLimiter, aiController.projectHealth);
workspaceRoutes.post('/ai/meeting-summary', aiRateLimiter, aiController.meetingSummary);
