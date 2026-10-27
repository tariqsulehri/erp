import { Router } from 'express';
import { z } from 'zod';
import { currentUserId, resolveAccessScope, requirePermission } from '../http/access-context.js';
import { resolveSellingBranchId } from '../modules/inventory/stock-holder-access.js';
import { SaleReturnDetailService } from '../modules/sale-returns/sale-return-detail.service.js';
import { CancelSaleReturnDraftInput, SaleReturnDraftService } from '../modules/sale-returns/sale-return-draft.service.js';
import { ListSaleReturnsQuery, SaleReturnListService } from '../modules/sale-returns/sale-return-list.service.js';
import { SaleReturnPostService } from '../modules/sale-returns/sale-return-post.service.js';
import { SaleReturnValidationService, ValidateSaleReturnInput } from '../modules/sale-returns/sale-return-validation.service.js';
import { SaleSupportService } from '../modules/sales/sale-support.service.js';

export const saleReturnsRouter = Router();

const saleReturnIdParams = z.object({
  id: z.string().uuid(),
});

const supportDataQuery = z.object({
  branch_id: z.string().uuid().optional(),
});

/** Sale Returns come back to a Branch: Branch users always get their own Branch, whatever the request says. */
function saleReturnInputFor(req: Parameters<typeof resolveAccessScope>[0]) {
  const scope = resolveAccessScope(req);
  const input = ValidateSaleReturnInput.parse(req.body);
  return { scope, input: { ...input, branch_id: resolveSellingBranchId(scope, input.branch_id, 'Sale Return') } };
}

saleReturnsRouter.get('/', async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const query = ListSaleReturnsQuery.parse(req.query);
    const service = new SaleReturnListService(scope.companyId, scope);
    res.json(await service.list(query));
  } catch (error) {
    next(error);
  }
});

saleReturnsRouter.get('/support-data', async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const { branch_id } = supportDataQuery.parse(req.query);
    const service = new SaleSupportService(scope.companyId);
    res.json(await service.getSupportData(scope, branch_id ?? null));
  } catch (error) {
    next(error);
  }
});

saleReturnsRouter.post('/validate', requirePermission('sales.edit'), async (req, res, next) => {
  try {
    const { scope, input } = saleReturnInputFor(req);
    const service = new SaleReturnValidationService(scope.companyId);
    res.json(await service.validate(input));
  } catch (error) {
    next(error);
  }
});

saleReturnsRouter.post('/drafts', requirePermission('sales.edit'), async (req, res, next) => {
  try {
    const { scope, input } = saleReturnInputFor(req);
    const service = new SaleReturnDraftService(scope.companyId);
    res.status(201).json(await service.createDraft(input, currentUserId(req)));
  } catch (error) {
    next(error);
  }
});

saleReturnsRouter.post('/create-and-post', requirePermission('sales.edit'), async (req, res, next) => {
  try {
    const { scope, input } = saleReturnInputFor(req);
    const service = new SaleReturnDraftService(scope.companyId);
    res.status(201).json(await service.createAndPost(input, currentUserId(req), scope));
  } catch (error) {
    next(error);
  }
});

saleReturnsRouter.put('/:id', requirePermission('sales.edit'), async (req, res, next) => {
  try {
    const { id } = saleReturnIdParams.parse(req.params);
    const { scope, input } = saleReturnInputFor(req);
    const service = new SaleReturnDraftService(scope.companyId);
    res.json(await service.updateDraft(id, input, currentUserId(req), scope));
  } catch (error) {
    next(error);
  }
});

saleReturnsRouter.post('/:id/update-and-post', requirePermission('sales.edit'), async (req, res, next) => {
  try {
    const { id } = saleReturnIdParams.parse(req.params);
    const { scope, input } = saleReturnInputFor(req);
    const service = new SaleReturnDraftService(scope.companyId);
    res.json(await service.updateAndPost(id, input, currentUserId(req), scope));
  } catch (error) {
    next(error);
  }
});

saleReturnsRouter.post('/:id/cancel', requirePermission('sales.edit'), async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const { id } = saleReturnIdParams.parse(req.params);
    const input = CancelSaleReturnDraftInput.parse(req.body);
    const service = new SaleReturnDraftService(scope.companyId);
    res.json(await service.cancelDraft(id, input, currentUserId(req), scope));
  } catch (error) {
    next(error);
  }
});

saleReturnsRouter.post('/:id/post', requirePermission('sales.edit'), async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const { id } = saleReturnIdParams.parse(req.params);
    const service = new SaleReturnPostService(scope.companyId);
    res.json(await service.post(id, currentUserId(req), scope));
  } catch (error) {
    next(error);
  }
});

saleReturnsRouter.get('/:id', async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const { id } = saleReturnIdParams.parse(req.params);
    const service = new SaleReturnDetailService(scope.companyId, scope);
    res.json(await service.getById(id));
  } catch (error) {
    next(error);
  }
});
