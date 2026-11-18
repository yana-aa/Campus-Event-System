import { Router, type RequestHandler } from 'express';
import type { AuthController } from '../controllers';
import type { AuthMiddleware } from '../middlewares';

export function authRoutes(controller: AuthController, auth: AuthMiddleware, limiter: RequestHandler): Router {
  const router = Router();
  router.post('/register', limiter, controller.register);
  router.post('/login', limiter, controller.login);
  router.get('/me', auth.authenticate, controller.me);
  return router;
}
