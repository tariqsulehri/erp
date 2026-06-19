import { Router } from 'express';
import { prisma } from '../db/prisma.js';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'erp-backend',
    timestamp: new Date().toISOString(),
  });
});

healthRouter.get('/database', async (_req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      database: 'postgresql',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});
