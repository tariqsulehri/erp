import { Router } from 'express';
import { z } from 'zod';
import { resolveCompanyId } from '../http/company-context.js';
import { createVoucherInputSchema, listVouchersQuerySchema } from '../modules/vouchers/voucher.schema.js';
import { VoucherService } from '../modules/vouchers/voucher.service.js';

export const vouchersRouter = Router();

function resolveUserId(req: { headers: Record<string, string | string[] | undefined> }) {
  const value = req.headers['x-user-id'];
  return Array.isArray(value) ? value[0] : value;
}

vouchersRouter.get('/', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const query = listVouchersQuerySchema.parse(req.query);
    const service = new VoucherService(companyId);
    res.json(await service.list(query));
  } catch (error) {
    next(error);
  }
});

vouchersRouter.post('/', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const input = createVoucherInputSchema.parse(req.body);
    const service = new VoucherService(companyId);
    res.status(201).json(await service.create(input, resolveUserId(req)));
  } catch (error) {
    next(error);
  }
});

vouchersRouter.get('/:id', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const id = z.string().uuid().parse(req.params.id);
    const service = new VoucherService(companyId);
    res.json(await service.getById(id));
  } catch (error) {
    next(error);
  }
});

vouchersRouter.post('/:id/post', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const id = z.string().uuid().parse(req.params.id);
    const service = new VoucherService(companyId);
    res.json(await service.post(id, resolveUserId(req)));
  } catch (error) {
    next(error);
  }
});

vouchersRouter.post('/:id/void', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const id = z.string().uuid().parse(req.params.id);
    const reason = z.string().trim().min(1).parse(req.body?.reason);
    const service = new VoucherService(companyId);
    res.json(await service.void(id, reason, resolveUserId(req)));
  } catch (error) {
    next(error);
  }
});
