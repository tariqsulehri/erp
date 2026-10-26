import { Router } from 'express';
import { z } from 'zod';
import { currentUserId, requirePermission } from '../http/access-context.js';
import { resolveCompanyId } from '../http/company-context.js';
import {
  createVoucherInputSchema,
  listVouchersQuerySchema,
  reverseVoucherSchema,
  voucherApprovalActionSchema,
  voucherRejectActionSchema,
} from '../modules/vouchers/voucher.schema.js';
import { VoucherService } from '../modules/vouchers/voucher.service.js';

export const vouchersRouter = Router();

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

vouchersRouter.post('/', requirePermission('vouchers.edit'), async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const input = createVoucherInputSchema.parse(req.body);
    const service = new VoucherService(companyId);
    res.status(201).json(await service.create(input, currentUserId(req)));
  } catch (error) {
    next(error);
  }
});

vouchersRouter.patch('/:id', requirePermission('vouchers.edit'), async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const id = z.string().uuid().parse(req.params.id);
    const input = createVoucherInputSchema.parse(req.body);
    const service = new VoucherService(companyId);
    res.json(await service.update(id, input, currentUserId(req)));
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

vouchersRouter.post('/:id/post', requirePermission('vouchers.post'), async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const id = z.string().uuid().parse(req.params.id);
    const service = new VoucherService(companyId);
    res.json(await service.post(id, currentUserId(req)));
  } catch (error) {
    next(error);
  }
});

vouchersRouter.post('/:id/request-approval', requirePermission('vouchers.edit'), async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const id = z.string().uuid().parse(req.params.id);
    const input = voucherApprovalActionSchema.parse(req.body ?? {});
    const service = new VoucherService(companyId);
    res.json(await service.requestApproval(id, input, currentUserId(req)));
  } catch (error) {
    next(error);
  }
});

vouchersRouter.post('/:id/approve', requirePermission('vouchers.approve'), async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const id = z.string().uuid().parse(req.params.id);
    const input = voucherApprovalActionSchema.parse(req.body ?? {});
    const service = new VoucherService(companyId);
    res.json(await service.approve(id, input, currentUserId(req)));
  } catch (error) {
    next(error);
  }
});

vouchersRouter.post('/:id/reject', requirePermission('vouchers.approve'), async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const id = z.string().uuid().parse(req.params.id);
    const input = voucherRejectActionSchema.parse(req.body ?? {});
    const service = new VoucherService(companyId);
    res.json(await service.reject(id, input, currentUserId(req)));
  } catch (error) {
    next(error);
  }
});

vouchersRouter.post('/:id/reverse', requirePermission('vouchers.reverse'), async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const id = z.string().uuid().parse(req.params.id);
    const input = reverseVoucherSchema.parse(req.body ?? {});
    const service = new VoucherService(companyId);
    res.json(await service.reverse(id, input, currentUserId(req)));
  } catch (error) {
    next(error);
  }
});

vouchersRouter.post('/:id/void', requirePermission('vouchers.reverse'), async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const id = z.string().uuid().parse(req.params.id);
    const reason = z.string().trim().min(1).parse(req.body?.reason);
    const service = new VoucherService(companyId);
    res.json(await service.void(id, reason, currentUserId(req)));
  } catch (error) {
    next(error);
  }
});
