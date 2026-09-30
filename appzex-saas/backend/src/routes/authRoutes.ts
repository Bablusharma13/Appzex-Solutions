import { Router } from 'express';
import * as authController from '../controllers/authController';
import { authenticate } from '../middleware/authenticate';
import { authRateLimiter } from '../middleware/rateLimit';

export const authRoutes = Router();

authRoutes.post('/login', authRateLimiter, authController.login);
authRoutes.post('/logout', authenticate, authController.logout);
authRoutes.get('/me', authenticate, authController.me);
