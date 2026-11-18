import type { PrismaClient } from '@prisma/client';
import { config, type AppConfig } from './config/env';
import {
  AdminController,
  AuthController,
  BookingController,
  EventController,
  OrganizerController,
  TicketController,
} from './controllers';
import type { ITicketPricingStrategy } from './interfaces';
import { BcryptPasswordHasher } from './lib/BcryptPasswordHasher';
import { HmacQRCodeGenerator } from './lib/HmacQRCodeGenerator';
import { JwtTokenService } from './lib/JwtTokenService';
import { getPrismaClient } from './lib/prisma';
import { RandomBookingCodeGenerator } from './lib/RandomBookingCodeGenerator';
import { createAuthMiddleware, type AuthMiddleware } from './middlewares';
import {
  PrismaAuditLogRepository,
  PrismaBookingRepository,
  PrismaEventRepository,
  PrismaTransactionManager,
  PrismaUserRepository,
  PrismaVenueRepository,
} from './repositories';
import {
  AdminAnalyticsService,
  AdminGovernanceService,
  AuthService,
  BookingService,
  EventService,
  QRCodeService,
} from './services';
import { FreeTicketStrategy, PaidTicketStrategy, PricingStrategyResolver } from './strategies';

export interface AppContainer {
  config: AppConfig;
  authMiddleware: AuthMiddleware;
  controllers: {
    auth: AuthController;
    events: EventController;
    bookings: BookingController;
    tickets: TicketController;
    organizer: OrganizerController;
    admin: AdminController;
  };
}

/**
 * Composition root: the only place concrete classes are instantiated and
 * wired together. Everything else depends on interfaces (DIP).
 */
export function buildContainer(
  prisma: PrismaClient = getPrismaClient(),
  appConfig: AppConfig = config,
  pricingStrategies: ITicketPricingStrategy[] = [new FreeTicketStrategy(), new PaidTicketStrategy()],
): AppContainer {
  // Infrastructure adapters
  const hasher = new BcryptPasswordHasher(appConfig.bcryptSaltRounds);
  const tokens = new JwtTokenService(appConfig.jwtSecret, appConfig.jwtExpiresIn);
  const qrGenerator = new HmacQRCodeGenerator(appConfig.qrHmacSecret);
  const codes = new RandomBookingCodeGenerator();
  const tx = new PrismaTransactionManager(prisma);

  // Repositories
  const users = new PrismaUserRepository(prisma);
  const venues = new PrismaVenueRepository(prisma);
  const events = new PrismaEventRepository(prisma);
  const bookings = new PrismaBookingRepository(prisma);
  const auditLogs = new PrismaAuditLogRepository(prisma);

  // Services
  const authService = new AuthService(users, hasher, tokens);
  const eventService = new EventService(events, venues);
  const bookingService = new BookingService(tx, bookings, new PricingStrategyResolver(pricingStrategies), qrGenerator, codes);
  const qrService = new QRCodeService(qrGenerator, bookings, events);
  const analyticsService = new AdminAnalyticsService(events, bookings, users);
  const governanceService = new AdminGovernanceService(tx, auditLogs);

  return {
    config: appConfig,
    authMiddleware: createAuthMiddleware(tokens, users),
    controllers: {
      auth: new AuthController(authService),
      events: new EventController(eventService, venues),
      bookings: new BookingController(bookingService),
      tickets: new TicketController(qrService),
      organizer: new OrganizerController(analyticsService, eventService),
      admin: new AdminController(analyticsService, governanceService),
    },
  };
}
