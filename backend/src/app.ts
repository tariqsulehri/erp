import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { authMiddleware } from './middleware/auth.js';
import { errorHandler } from './middleware/error-handler.js';
import { requestLog } from './middleware/request-log.js';
import { usePlainErrorMessages } from './http/plain-error-map.js';

// Plain-English defaults for request checks without a message of their own.
usePlainErrorMessages();
import { healthRouter } from './routes/health.routes.js';
import { publicAuthRouter } from './routes/auth.routes.js';
import { apiRouter } from './routes/index.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // The API sits behind the Next.js proxy (and possibly one reverse proxy), which set x-forwarded-for.
  app.set('trust proxy', env.TRUST_PROXY_HOPS);
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(requestLog);

  app.get('/', (_req, res) => {
    res.json({
      name: 'ERP Backend API',
      version: '0.1.0',
      status: 'ok',
    });
  });

  app.use('/health', healthRouter);
  app.use('/api/v1/auth', publicAuthRouter);
  app.use('/api/v1', authMiddleware, apiRouter);
  app.use(errorHandler);

  return app;
}
