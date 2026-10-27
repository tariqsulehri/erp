import { Prisma } from '@prisma/client';
import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { logger } from '../config/logger.js';

/** Known database errors that are the user's problem, not a server fault. */
function databaseRequestError(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return null;
  if (error.code === 'P2002') return { statusCode: 409, message: 'This record already exists. Please use a different number or code.' };
  if (error.code === 'P2025') return { statusCode: 404, message: 'The record was not found. It may have been changed or removed.' };
  if (error.code === 'P2003') return { statusCode: 409, message: 'This record is linked to other records and cannot be changed this way.' };
  return null;
}

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof ZodError) {
    const details = error.flatten();

    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Some details are not correct. Please check the highlighted fields.',
        details: {
          ...details,
          issues: error.issues.map(issue => ({
            path: issue.path.map(part => String(part)).join('.'),
            message: issue.message,
          })),
        },
      },
    });
    return;
  }

  const databaseError = databaseRequestError(error);
  const statusCode = databaseError?.statusCode ?? (typeof error?.statusCode === 'number' ? error.statusCode : 500);

  if (statusCode >= 500) {
    // Full details stay in the server log; the user sees a general message with the request ID for support.
    logger.error('Unhandled request error', {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      userId: req.user?.id,
      companyId: req.header('x-company-id'),
      error,
    });
  }

  res.status(statusCode).json({
    error: {
      code: statusCode === 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR',
      message: statusCode === 500
        ? `Something went wrong. Please try again. If it happens again, give support this Reference: ${req.requestId ?? 'not available'}`
        : databaseError?.message ?? error.message,
      ...(statusCode === 500 && req.requestId ? { reference: req.requestId } : {}),
    },
  });
};
