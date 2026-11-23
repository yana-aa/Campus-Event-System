import cors from 'cors';
import express, { type Express } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { buildContainer, type AppContainer } from './container';
import { errorHandler, notFoundHandler } from './middlewares';
import { createApiRouter } from './routes';

/**
 * Builds the Express application without binding a port, so Supertest can
 * drive it in-process. Pass a custom container to swap dependencies.
 */
export function createApp(container: AppContainer = buildContainer()): Express {
  const app = express();
  const { config } = container;

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigin === '*' ? '*' : config.corsOrigin.split(',').map((o) => o.trim()),
    }),
  );
  app.use(express.json({ limit: '100kb' }));

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.authRateLimitMax,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => config.isTest,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts, please try again later' } },
  });

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'campuspass-api', time: new Date().toISOString() });
  });

  app.use('/api', createApiRouter(container, authLimiter));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;
