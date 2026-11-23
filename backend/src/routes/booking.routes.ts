import { Router } from 'express';
import type { BookingController } from '../controllers';
import { authorizeRoles, type AuthMiddleware } from '../middlewares';
import { Role } from '../models';

export function bookingRoutes(controller: BookingController, auth: AuthMiddleware): Router {
  const router = Router();
  router.use(auth.authenticate);
  router.post('/', authorizeRoles(Role.STUDENT), controller.create);
  router.get('/me', controller.listMine);
  router.delete('/:id', controller.cancel);
  return router;
}
