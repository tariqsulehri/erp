import { Router } from 'express';
import { currentUserId } from '../http/access-context.js';
import { assertLoginAllowed, clearFailedLogins, recordFailedLogin } from '../middleware/login-attempt-limit.js';
import { authRateLimiter } from '../middleware/rate-limiter.js';
import { changePasswordSchema, loginSchema } from '../modules/auth/auth.schema.js';
import { AuthService } from '../modules/auth/auth.service.js';

const authService = new AuthService();

/** Sign-in is the only API route that works without a token. */
export const publicAuthRouter = Router();

publicAuthRouter.post('/login', authRateLimiter, async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const ip = req.ip ?? 'unknown';
    assertLoginAllowed(input.email, ip);
    try {
      const result = await authService.login(input);
      clearFailedLogins(input.email, ip);
      res.json(result);
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode === 401) recordFailedLogin(input.email, ip);
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

/** Routes for the signed-in user's own account. */
export const authRouter = Router();

authRouter.get('/me', async (req, res, next) => {
  try {
    res.json(await authService.profile(currentUserId(req)));
  } catch (error) {
    next(error);
  }
});

authRouter.post('/change-password', async (req, res, next) => {
  try {
    const input = changePasswordSchema.parse(req.body);
    const userKey = `user:${currentUserId(req)}`;
    const ip = req.ip ?? 'unknown';
    assertLoginAllowed(userKey, ip);
    try {
      res.json(await authService.changePassword(currentUserId(req), input));
      clearFailedLogins(userKey, ip);
    } catch (error) {
      if ((error as { code?: string }).code === 'WRONG_PASSWORD') recordFailedLogin(userKey, ip);
      throw error;
    }
  } catch (error) {
    next(error);
  }
});
