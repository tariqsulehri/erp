import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { Context } from './context';

/**
 * Initialize tRPC with custom context
 * Every procedure has access to: user, company, database, redis, logger
 */
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        timestamp: new Date().toISOString(),
      },
    };
  },
});

/**
 * Export reusable router and procedure helpers
 */
export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * Middleware to check authentication
 */
const isAuthenticated = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Not authenticated',
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

/**
 * Protected procedure (requires authentication)
 */
export const protectedProcedure = t.procedure.use(isAuthenticated);

/**
 * Middleware to check authorization by role
 */
export function requireRole(...allowedRoles: string[]) {
  return t.middleware(({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Not authenticated',
      });
    }

    if (!allowedRoles.includes(ctx.user.role)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `Required role(s): ${allowedRoles.join(', ')}`,
      });
    }

    return next({ ctx });
  });
}

/**
 * Middleware for logging procedure calls
 */
export function logProcedure() {
  return t.middleware(({ path, type, next }) => {
    const start = Date.now();

    return next().then(result => {
      const duration = Date.now() - start;
      console.log(`[${type}] ${path} - ${duration}ms`);
      return result;
    });
  });
}

/**
 * Middleware for error handling and validation
 */
export function validateInput() {
  return t.middleware(({ next }) => {
    // Validation logic can be added here
    return next();
  });
}

export type Router = typeof router;
