import { Router } from 'express';
import { z } from 'zod';
import { currentUserId, resolveAccessScope, requirePermission } from '../http/access-context.js';
import { assertWarehouseDocumentAccess, purchaseWarehouseFilter, requireAllBranchAccess, resolvePurchasingWarehouseId } from '../modules/inventory/stock-holder-access.js';
import { PurchaseReturnDetailService } from '../modules/purchase-returns/purchase-return-detail.service.js';
import { CancelPurchaseReturnDraftInput, PurchaseReturnDraftService } from '../modules/purchase-returns/purchase-return-draft.service.js';
import { ListPurchaseReturnsQuery, PurchaseReturnListService } from '../modules/purchase-returns/purchase-return-list.service.js';
import { PurchaseReturnPostService } from '../modules/purchase-returns/purchase-return-post.service.js';
import { PurchaseReturnValidationService, ValidatePurchaseReturnInput } from '../modules/purchase-returns/purchase-return-validation.service.js';
import { PurchaseSupportService } from '../modules/purchases/purchase-support.service.js';

export const purchaseReturnsRouter = Router();

const purchaseReturnIdParams = z.object({
  id: z.string().uuid(),
});

purchaseReturnsRouter.get('/', async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    // Warehouse users see only their Warehouse's documents; Branch users cannot open purchases.
    const ownWarehouseId = purchaseWarehouseFilter(scope, 'Purchase Return');
    const query = { ...ListPurchaseReturnsQuery.parse(req.query), ...(ownWarehouseId ? { warehouse_id: ownWarehouseId } : {}) };
    const service = new PurchaseReturnListService(companyId);
    res.json(await service.list(query));
  } catch (error) {
    next(error);
  }
});

purchaseReturnsRouter.get('/support-data', async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    purchaseWarehouseFilter(scope, 'Purchase Return');
    const service = new PurchaseSupportService(companyId);
    res.json(await service.getSupportData());
  } catch (error) {
    next(error);
  }
});

purchaseReturnsRouter.post('/validate', requirePermission('purchases.edit'), async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const parsed = ValidatePurchaseReturnInput.parse(req.body);
    const input = { ...parsed, warehouse_id: resolvePurchasingWarehouseId(scope, parsed.warehouse_id, 'Purchase Return') };
    const service = new PurchaseReturnValidationService(companyId);
    res.json(await service.validate(input));
  } catch (error) {
    next(error);
  }
});

purchaseReturnsRouter.post('/drafts', requirePermission('purchases.edit'), async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const parsed = ValidatePurchaseReturnInput.parse(req.body);
    const input = { ...parsed, warehouse_id: resolvePurchasingWarehouseId(scope, parsed.warehouse_id, 'Purchase Return') };
    const service = new PurchaseReturnDraftService(companyId);
    res.status(201).json(await service.createDraft(input, currentUserId(req)));
  } catch (error) {
    next(error);
  }
});

purchaseReturnsRouter.post('/create-and-post', requirePermission('purchases.edit'), async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const parsed = ValidatePurchaseReturnInput.parse(req.body);
    const input = { ...parsed, warehouse_id: resolvePurchasingWarehouseId(scope, parsed.warehouse_id, 'Purchase Return') };
    const service = new PurchaseReturnDraftService(companyId);
    res.status(201).json(await service.createAndPost(input, currentUserId(req)));
  } catch (error) {
    next(error);
  }
});

purchaseReturnsRouter.put('/:id', requirePermission('purchases.edit'), async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const { id } = purchaseReturnIdParams.parse(req.params);
    await assertWarehouseDocumentAccess(scope, 'purchase_returns', id);
    const parsed = ValidatePurchaseReturnInput.parse(req.body);
    const input = { ...parsed, warehouse_id: resolvePurchasingWarehouseId(scope, parsed.warehouse_id, 'Purchase Return') };
    const service = new PurchaseReturnDraftService(companyId);
    res.json(await service.updateDraft(id, input, currentUserId(req)));
  } catch (error) {
    next(error);
  }
});

purchaseReturnsRouter.post('/:id/update-and-post', requirePermission('purchases.edit'), async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const { id } = purchaseReturnIdParams.parse(req.params);
    await assertWarehouseDocumentAccess(scope, 'purchase_returns', id);
    const parsed = ValidatePurchaseReturnInput.parse(req.body);
    const input = { ...parsed, warehouse_id: resolvePurchasingWarehouseId(scope, parsed.warehouse_id, 'Purchase Return') };
    const service = new PurchaseReturnDraftService(companyId);
    res.json(await service.updateAndPost(id, input, currentUserId(req)));
  } catch (error) {
    next(error);
  }
});

purchaseReturnsRouter.post('/:id/cancel', requirePermission('purchases.edit'), async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const { id } = purchaseReturnIdParams.parse(req.params);
    await assertWarehouseDocumentAccess(scope, 'purchase_returns', id);
    const input = CancelPurchaseReturnDraftInput.parse(req.body);
    const service = new PurchaseReturnDraftService(companyId);
    res.json(await service.cancelDraft(id, input, currentUserId(req)));
  } catch (error) {
    next(error);
  }
});

purchaseReturnsRouter.post('/:id/post', requirePermission('purchases.edit'), async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const { id } = purchaseReturnIdParams.parse(req.params);
    await assertWarehouseDocumentAccess(scope, 'purchase_returns', id);
    const service = new PurchaseReturnPostService(companyId);
    res.json(await service.post(id, currentUserId(req)));
  } catch (error) {
    next(error);
  }
});

purchaseReturnsRouter.get('/:id', async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const { id } = purchaseReturnIdParams.parse(req.params);
    await assertWarehouseDocumentAccess(scope, 'purchase_returns', id);
    const service = new PurchaseReturnDetailService(companyId);
    res.json(await service.getById(id));
  } catch (error) {
    next(error);
  }
});
