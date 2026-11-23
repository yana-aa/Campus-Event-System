import { Router } from 'express';
import type { EventController } from '../controllers';
import { authorizeRoles, type AuthMiddleware } from '../middlewares';
import { Role } from '../models';

export function eventRoutes(controller: EventController, auth: AuthMiddleware): Router {
  const router = Router();
  router.get('/', controller.list);
  router.get('/:id', auth.optionalAuth, controller.getById);
  router.post('/', auth.authenticate, authorizeRoles(Role.ORGANIZER), controller.create);
  router.patch('/:id', auth.authenticate, authorizeRoles(Role.ORGANIZER, Role.ADMIN), controller.update);
  return router;
}

export function venueRoutes(controller: EventController): Router {
  const router = Router();
  router.get('/', controller.listVenues);
  return router;
}
