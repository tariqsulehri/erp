import type { Request, Response, NextFunction } from 'express';
import { LRUCache } from 'lru-cache';

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  message?: string;
  statusCode?: number;
  keyGenerator?: (req: Request) => string;
}

export interface RateLimiterMiddleware {
  (req: Request, res: Response, next: NextFunction): void;
  reset: (key?: string) => void;
  setMax: (newMax: number) => void;
}

/**
 * In-memory sliding rate limiter per IP/key using LRUCache.
 * Protects public endpoints from brute force and automated denial of service.
 */
export function createRateLimiter(options: RateLimitOptions = {}): RateLimiterMiddleware {
  const windowMs = options.windowMs ?? 60 * 1000;
  let max = options.max ?? (process.env.NODE_ENV === 'test' ? 100 : 10);
  const message = options.message ?? 'Too many requests. Please wait a moment and try again.';
  const statusCode = options.statusCode ?? 429;
  const keyGenerator = options.keyGenerator ?? ((req: Request) => req.ip ?? 'unknown');

  const cache = new LRUCache<string, { count: number; resetTime: number }>({
    max: 10_000,
    ttl: windowMs,
  });

  const middleware = ((req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator(req);
    const now = Date.now();
    let record = cache.get(key);

    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
      cache.set(key, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, max - record.count);
    const retryAfterSeconds = Math.max(1, Math.ceil((record.resetTime - now) / 1000));

    res.setHeader('RateLimit-Limit', max);
    res.setHeader('RateLimit-Remaining', remaining);
    res.setHeader('RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    if (record.count > max) {
      res.setHeader('Retry-After', retryAfterSeconds);
      res.status(statusCode).json({
        error: {
          code: 'TOO_MANY_REQUESTS',
          message,
          requestId: req.requestId,
        },
      });
      return;
    }

    next();
  }) as RateLimiterMiddleware;

  middleware.reset = (key?: string) => {
    if (key) {
      cache.delete(key);
    } else {
      cache.clear();
    }
  };

  middleware.setMax = (newMax: number) => {
    max = newMax;
  };

  return middleware;
}

/**
 * Default rate limiter for public authentication (login).
 * In production/dev: max 10 requests per minute per IP.
 * In test environment: relaxed to 100 or configurable via setMax/reset.
 */
export const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 100 : 10,
  message: 'Too many sign-in attempts from this IP address. Please wait a minute and try again.',
});

