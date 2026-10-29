import { describe, expect, it } from 'vitest';
import { createRateLimiter } from '../src/middleware/rate-limiter.js';
import type { Request, Response } from 'express';

describe('Rate Limiter Middleware (SEC-002)', () => {
  function createMockReqRes(ip = '192.168.1.1', requestId = 'test-request-id') {
    const headers: Record<string, string | number> = {};
    const req = {
      ip,
      requestId,
    } as unknown as Request;

    const res = {
      statusCode: 200,
      headers,
      setHeader(name: string, value: string | number) {
        headers[name.toLowerCase()] = value;
      },
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(data: any) {
        this.body = data;
        return this;
      },
    } as unknown as Response & { body?: any; headers: Record<string, string | number> };

    return { req, res };
  }

  it('allows requests within limit and tracks remaining quota', () => {
    const limiter = createRateLimiter({
      windowMs: 60 * 1000,
      max: 3,
    });

    const calls: number[] = [];
    const next = () => calls.push(1);

    const first = createMockReqRes('10.0.0.1');
    limiter(first.req, first.res, next);
    expect(calls.length).toBe(1);
    expect(first.res.statusCode).toBe(200);
    expect(first.res.headers['ratelimit-remaining']).toBe(2);

    const second = createMockReqRes('10.0.0.1');
    limiter(second.req, second.res, next);
    expect(calls.length).toBe(2);
    expect(second.res.headers['ratelimit-remaining']).toBe(1);

    const third = createMockReqRes('10.0.0.1');
    limiter(third.req, third.res, next);
    expect(calls.length).toBe(3);
    expect(third.res.headers['ratelimit-remaining']).toBe(0);
  });

  it('returns 429 Too Many Requests and sets Retry-After when limit is exceeded', () => {
    const limiter = createRateLimiter({
      windowMs: 60 * 1000,
      max: 2,
      message: 'Too many login attempts. Please wait a minute and try again.',
    });

    let nextCalls = 0;
    const next = () => { nextCalls += 1; };

    // Request 1 & 2 pass
    const r1 = createMockReqRes('10.0.0.2');
    limiter(r1.req, r1.res, next);
    const r2 = createMockReqRes('10.0.0.2');
    limiter(r2.req, r2.res, next);
    expect(nextCalls).toBe(2);

    // Request 3 is blocked
    const r3 = createMockReqRes('10.0.0.2');
    limiter(r3.req, r3.res, next);
    expect(nextCalls).toBe(2); // next() was not called
    expect(r3.res.statusCode).toBe(429);
    expect(r3.res.headers['retry-after']).toBeGreaterThanOrEqual(1);
    expect(r3.res.headers['ratelimit-limit']).toBe(2);
    expect(r3.res.headers['ratelimit-remaining']).toBe(0);
    expect(r3.res.body).toEqual({
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many login attempts. Please wait a minute and try again.',
        requestId: 'test-request-id',
      },
    });
  });

  it('tracks distinct IP addresses independently', () => {
    const limiter = createRateLimiter({
      windowMs: 60 * 1000,
      max: 1,
    });

    let nextCalls = 0;
    const next = () => { nextCalls += 1; };

    // IP 1
    const r1 = createMockReqRes('10.0.0.10');
    limiter(r1.req, r1.res, next);
    expect(nextCalls).toBe(1);

    // IP 2 is not affected by IP 1
    const r2 = createMockReqRes('10.0.0.11');
    limiter(r2.req, r2.res, next);
    expect(nextCalls).toBe(2);

    // Second request from IP 1 is blocked
    const r3 = createMockReqRes('10.0.0.10');
    limiter(r3.req, r3.res, next);
    expect(nextCalls).toBe(2);
    expect(r3.res.statusCode).toBe(429);
  });

  it('resets counters when requested', () => {
    const limiter = createRateLimiter({
      windowMs: 60 * 1000,
      max: 1,
    });

    let nextCalls = 0;
    const next = () => { nextCalls += 1; };

    const r1 = createMockReqRes('10.0.0.20');
    limiter(r1.req, r1.res, next);
    expect(nextCalls).toBe(1);

    limiter.reset('10.0.0.20');

    const r2 = createMockReqRes('10.0.0.20');
    limiter(r2.req, r2.res, next);
    expect(nextCalls).toBe(2);
    expect(r2.res.statusCode).toBe(200);
  });
});

