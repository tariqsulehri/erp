import type { Request } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import type { AuthUser } from '../modules/auth/access-rules.js';

const companyIdSchema = z.string().uuid();

function requestError(message: string, statusCode: number) {
  const error = new Error(message);
  Object.assign(error, { statusCode });
  return error;
}

export function requireUser(req: Request): AuthUser {
  if (!req.user) throw requestError('Please sign in to continue.', 401);
  return req.user;
}

export function resolveCompanyId(req: Request) {
  const user = requireUser(req);
  const companyId = req.header('x-company-id')?.trim() || env.DEFAULT_COMPANY_ID;
  const result = companyIdSchema.safeParse(companyId);

  if (!result.success) {
    throw requestError('Company is not selected.', 400);
  }

  // Admin users can open any company; everyone else needs an active access record for it.
  if (user.role !== 'admin' && !user.access.some(access => access.companyId === result.data)) {
    throw requestError('You do not have access to this company.', 403);
  }

  return result.data;
}
