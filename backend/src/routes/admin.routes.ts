import { Router } from 'express';
import type { AdminController } from '../controllers';
import { authorizeRoles, type AuthMiddleware } from '../middlewares';
import { Role } from '../models';

export function adminRoutes(controller: AdminController, auth: AuthMiddleware): Router {
  const router = Router();
  router.use(auth.authenticate, authorizeRoles(Role.ADMIN));
  router.get('/overview', controller.overview);
  router.patch('/events/:id/status', controller.changeEventStatus);
  router.patch('/users/:id/status', controller.changeUserStatus);
  router.get('/audit-logs', controller.auditLogs);
  return router;
}
