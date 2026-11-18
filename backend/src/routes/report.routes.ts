import { Router } from 'express';
import type { ReportController } from '../controllers';
import type { AuthMiddleware } from '../middlewares';

export function reportRoutes(controller: ReportController, auth: AuthMiddleware): Router {
  const router = Router();
  router.post('/', auth.authenticate, controller.create);
  return router;
}
