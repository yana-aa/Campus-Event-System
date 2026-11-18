import { Router } from 'express';
import type { TicketController } from '../controllers';
import { authorizeRoles, type AuthMiddleware } from '../middlewares';
import { Role } from '../models';

export function ticketRoutes(controller: TicketController, auth: AuthMiddleware): Router {
  const router = Router();
  router.post('/validate', auth.authenticate, authorizeRoles(Role.ORGANIZER, Role.ADMIN), controller.validate);
  return router;
}
