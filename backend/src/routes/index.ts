import { Router, type RequestHandler } from 'express';
import type { AppContainer } from '../container';
import { adminRoutes } from './admin.routes';
import { authRoutes } from './auth.routes';
import { bookingRoutes } from './booking.routes';
import { eventRoutes, venueRoutes } from './event.routes';
import { organizerRoutes } from './organizer.routes';
import { reportRoutes } from './report.routes';
import { ticketRoutes } from './ticket.routes';

export function createApiRouter(container: AppContainer, authLimiter: RequestHandler): Router {
  const { controllers, authMiddleware } = container;
  const router = Router();
  router.use('/auth', authRoutes(controllers.auth, authMiddleware, authLimiter));
  router.use('/events', eventRoutes(controllers.events, authMiddleware));
  router.use('/venues', venueRoutes(controllers.events));
  router.use('/bookings', bookingRoutes(controllers.bookings, authMiddleware));
  router.use('/tickets', ticketRoutes(controllers.tickets, authMiddleware));
  router.use('/organizer', organizerRoutes(controllers.organizer, authMiddleware));
  router.use('/admin', adminRoutes(controllers.admin, authMiddleware));
  router.use('/reports', reportRoutes(controllers.reports, authMiddleware));
  return router;
}
