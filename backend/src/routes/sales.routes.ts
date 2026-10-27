import { Router } from 'express';
import { z } from 'zod';
import { currentUserId, resolveAccessScope, requirePermission } from '../http/access-context.js';
import { resolveSellingBranchId } from '../modules/inventory/stock-holder-access.js';
import { SaleDetailService } from '../modules/sales/sale-detail.service.js';
import { CancelSaleDraftInput, SaleDraftService } from '../modules/sales/sale-draft.service.js';
import { ListSaleInvoicesQuery, SaleListService } from '../modules/sales/sale-list.service.js';
import { SalePostService } from '../modules/sales/sale-post.service.js';
import { SaleSupportService } from '../modules/sales/sale-support.service.js';
import { SaleValidationService, ValidateSaleInvoiceInput } from '../modules/sales/sale-validation.service.js';

export const salesRouter = Router();

const saleIdParams = z.object({
  id: z.string().uuid(),
});

const supportDataQuery = z.object({
  branch_id: z.string().uuid().optional(),
});

/** Sales happen at a Branch: Branch users always get their own Branch, whatever the request says. */
function saleInputFor(req: Parameters<typeof resolveAccessScope>[0]) {
  const scope = resolveAccessScope(req);
  const input = ValidateSaleInvoiceInput.parse(req.body);
  return { scope, input: { ...input, branch_id: resolveSellingBranchId(scope, input.branch_id, 'Sale Voucher') } };
}

salesRouter.get('/', async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const query = ListSaleInvoicesQuery.parse(req.query);
    const service = new SaleListService(scope.companyId, scope);
    res.json(await service.list(query));
  } catch (error) {
    next(error);
  }
});

salesRouter.get('/support-data', async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const { branch_id } = supportDataQuery.parse(req.query);
    const service = new SaleSupportService(scope.companyId);
    res.json(await service.getSupportData(scope, branch_id ?? null));
  } catch (error) {
    next(error);
  }
});

salesRouter.post('/validate', requirePermission('sales.edit'), async (req, res, next) => {
  try {
    const { scope, input } = saleInputFor(req);
    const service = new SaleValidationService(scope.companyId);
    res.json(await service.validate(input));
  } catch (error) {
    next(error);
  }
});

salesRouter.post('/drafts', requirePermission('sales.edit'), async (req, res, next) => {
  try {
    const { scope, input } = saleInputFor(req);
    const service = new SaleDraftService(scope.companyId);
    res.status(201).json(await service.createDraft(input, currentUserId(req)));
  } catch (error) {
    next(error);
  }
});

salesRouter.post('/create-and-post', requirePermission('sales.edit'), async (req, res, next) => {
  try {
    const { scope, input } = saleInputFor(req);
    const service = new SaleDraftService(scope.companyId);
    res.status(201).json(await service.createAndPost(input, currentUserId(req), scope));
  } catch (error) {
    next(error);
  }
});

salesRouter.put('/:id', requirePermission('sales.edit'), async (req, res, next) => {
  try {
    const { id } = saleIdParams.parse(req.params);
    const { scope, input } = saleInputFor(req);
    const service = new SaleDraftService(scope.companyId);
    res.json(await service.updateDraft(id, input, currentUserId(req), scope));
  } catch (error) {
    next(error);
  }
});

salesRouter.post('/:id/update-and-post', requirePermission('sales.edit'), async (req, res, next) => {
  try {
    const { id } = saleIdParams.parse(req.params);
    const { scope, input } = saleInputFor(req);
    const service = new SaleDraftService(scope.companyId);
    res.json(await service.updateAndPost(id, input, currentUserId(req), scope));
  } catch (error) {
    next(error);
  }
});

salesRouter.post('/:id/cancel', requirePermission('sales.edit'), async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const { id } = saleIdParams.parse(req.params);
    const input = CancelSaleDraftInput.parse(req.body);
    const service = new SaleDraftService(scope.companyId);
    res.json(await service.cancelDraft(id, input, currentUserId(req), scope));
  } catch (error) {
    next(error);
  }
});

salesRouter.post('/:id/post', requirePermission('sales.edit'), async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const { id } = saleIdParams.parse(req.params);
    const service = new SalePostService(scope.companyId);
    res.json(await service.post(id, currentUserId(req), scope));
  } catch (error) {
    next(error);
  }
});

salesRouter.get('/:id', async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const { id } = saleIdParams.parse(req.params);
    const service = new SaleDetailService(scope.companyId, scope);
    res.json(await service.getById(id));
  } catch (error) {
    next(error);
  }
});
