import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { logger } from '../config/logger.js';

declare module 'express-serve-static-core' {
  interface Request {
    requestId?: string;
  }
}

const requestIdPattern = /^[A-Za-z0-9-]{8,64}$/;

/**
 * Gives every request an ID (reusing a safe `x-request-id` from the frontend proxy), returns it in the
 * response header, and writes one access log line when the response finishes.
 */
export const requestLog: RequestHandler = (req, res, next) => {
  const incoming = req.header('x-request-id');
  const requestId = incoming && requestIdPattern.test(incoming) ? incoming : randomUUID();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    if (req.path.startsWith('/health')) return;
    logger.info('request', {
      requestId,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      durationMs: Number((process.hrtime.bigint() - startedAt) / 1_000_000n),
      ip: req.ip,
      userId: req.user?.id,
    });
  });
  next();
};
