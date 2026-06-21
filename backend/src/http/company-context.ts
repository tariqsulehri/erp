import type { Request } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';

const companyIdSchema = z.string().uuid();

export function resolveCompanyId(req: Request) {
  const companyId = req.header('x-company-id')?.trim() || env.DEFAULT_COMPANY_ID;
  const result = companyIdSchema.safeParse(companyId);

  if (!result.success) {
    const error = new Error('Company is not selected.');
    Object.assign(error, { statusCode: 400 });
    throw error;
  }

  return result.data;
}
