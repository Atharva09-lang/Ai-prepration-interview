import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';

import { env } from './config/env.js';
import { sessionMiddleware } from './config/session.js';

import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import kitRoutes from './routes/kit.routes.js';
import jobRoutes from './routes/job.routes.js';

import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

export function createApp({ sessionStore } = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet());

  app.use(
    cors({
      origin: env.CLIENT_ORIGIN,
      credentials: true,
    })
  );

  app.use(express.json({ limit: '1mb' }));

  if (env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  app.use(sessionMiddleware(sessionStore));

  // Root route
  app.get('/', (req, res) => {
    res.status(200).json({
      message: 'AI Interview Prep Kit API is running',
      status: 'ok',
      version: '1.0',
    });
  });

  // API routes
  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/kits', kitRoutes);
  app.use('/api/jobs', jobRoutes);

  // 404 handler
  app.use(notFoundHandler);

  // Global error handler
  app.use(errorHandler);

  return app;
}