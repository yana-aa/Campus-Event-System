import { Router } from 'express';
import type { OrganizerController } from '../controllers';
import { authorizeRoles, type AuthMiddleware } from '../middlewares';
import { Role } from '../models';

export function organizerRoutes(controller: OrganizerController, auth: AuthMiddleware): Router {
  const router = Router();
  router.use(auth.authenticate, authorizeRoles(Role.ORGANIZER));
  router.get('/dashboard', controller.dashboard);
  router.get('/events', controller.myEvents);
  return router;
}
