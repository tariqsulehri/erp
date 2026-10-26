import type { NextFunction, Request, Response } from 'express';
import type { AuthUser } from '../modules/auth/access-rules.js';
import { AuthService } from '../modules/auth/auth.service.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const authService = new AuthService();

/** Every API request must carry a valid sign-in token. There is no anonymous or development fallback user. */
export async function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  if (req.path === '/health' || req.path.startsWith('/health/')) {
    return next();
  }

  const authHeader = req.header('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    const error = new Error('Please sign in to continue.');
    Object.assign(error, { statusCode: 401 });
    return next(error);
  }

  try {
    req.user = await authService.authenticate(authHeader.substring(7).trim());
    return next();
  } catch (error) {
    return next(error);
  }
}
