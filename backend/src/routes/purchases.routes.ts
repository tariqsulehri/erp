import { Router } from 'express';
import { currentUserId, resolveAccessScope, requirePermission } from '../http/access-context.js';
import { assertWarehouseDocumentAccess, purchaseWarehouseFilter, requireAllBranchAccess, resolvePurchasingWarehouseId } from '../modules/inventory/stock-holder-access.js';
import { PurchaseAnalyticsQuery, PurchaseAnalyticsService } from '../modules/purchases/purchase-analytics.service.js';
import { PurchaseDetailService } from '../modules/purchases/purchase-detail.service.js';
import { CancelPurchaseDraftInput, PurchaseDraftService } from '../modules/purchases/purchase-draft.service.js';
import { ListPurchaseInvoicesQuery, PurchaseListService } from '../modules/purchases/purchase-list.service.js';
import { PurchasePostService } from '../modules/purchases/purchase-post.service.js';
import { PurchaseSupportService } from '../modules/purchases/purchase-support.service.js';
import { PurchaseValidationService, ValidatePurchaseInvoiceInput } from '../modules/purchases/purchase-validation.service.js';
import { z } from 'zod';

export const purchasesRouter = Router();

const purchaseIdParams = z.object({
  id: z.string().uuid(),
});

purchasesRouter.get('/', async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    // Warehouse users see only their Warehouse's documents; Branch users cannot open purchases.
    const ownWarehouseId = purchaseWarehouseFilter(scope, 'Purchase Voucher');
    const query = { ...ListPurchaseInvoicesQuery.parse(req.query), ...(ownWarehouseId ? { warehouse_id: ownWarehouseId } : {}) };
    const service = new PurchaseListService(companyId);
    res.json(await service.list(query));
  } catch (error) {
    next(error);
  }
});

purchasesRouter.get('/analytics', async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    requireAllBranchAccess(scope, 'Purchase Analytics');
    const query = PurchaseAnalyticsQuery.parse(req.query);
    const service = new PurchaseAnalyticsService(companyId);
    res.json(await service.analytics(query));
  } catch (error) {
    next(error);
  }
});

purchasesRouter.get('/support-data', async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    purchaseWarehouseFilter(scope, 'Purchase Voucher');
    const service = new PurchaseSupportService(companyId);
    res.json(await service.getSupportData());
  } catch (error) {
    next(error);
  }
});

purchasesRouter.post('/validate', requirePermission('purchases.edit'), async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const parsed = ValidatePurchaseInvoiceInput.parse(req.body);
    const input = { ...parsed, warehouse_id: resolvePurchasingWarehouseId(scope, parsed.warehouse_id, 'Purchase Voucher') };
    const service = new PurchaseValidationService(companyId);
    res.json(await service.validate(input));
  } catch (error) {
    next(error);
  }
});

purchasesRouter.post('/drafts', requirePermission('purchases.edit'), async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const parsed = ValidatePurchaseInvoiceInput.parse(req.body);
    const input = { ...parsed, warehouse_id: resolvePurchasingWarehouseId(scope, parsed.warehouse_id, 'Purchase Voucher') };
    const service = new PurchaseDraftService(companyId);
    res.status(201).json(await service.createDraft(input, currentUserId(req)));
  } catch (error) {
    next(error);
  }
});

purchasesRouter.post('/create-and-post', requirePermission('purchases.edit'), async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const parsed = ValidatePurchaseInvoiceInput.parse(req.body);
    const input = { ...parsed, warehouse_id: resolvePurchasingWarehouseId(scope, parsed.warehouse_id, 'Purchase Voucher') };
    const service = new PurchaseDraftService(companyId);
    res.status(201).json(await service.createAndPost(input, currentUserId(req)));
  } catch (error) {
    next(error);
  }
});

purchasesRouter.put('/:id', requirePermission('purchases.edit'), async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const { id } = purchaseIdParams.parse(req.params);
    await assertWarehouseDocumentAccess(scope, 'purchase_invoices', id);
    const parsed = ValidatePurchaseInvoiceInput.parse(req.body);
    const input = { ...parsed, warehouse_id: resolvePurchasingWarehouseId(scope, parsed.warehouse_id, 'Purchase Voucher') };
    const service = new PurchaseDraftService(companyId);
    res.json(await service.updateDraft(id, input, currentUserId(req)));
  } catch (error) {
    next(error);
  }
});

purchasesRouter.post('/:id/update-and-post', requirePermission('purchases.edit'), async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const { id } = purchaseIdParams.parse(req.params);
    await assertWarehouseDocumentAccess(scope, 'purchase_invoices', id);
    const parsed = ValidatePurchaseInvoiceInput.parse(req.body);
    const input = { ...parsed, warehouse_id: resolvePurchasingWarehouseId(scope, parsed.warehouse_id, 'Purchase Voucher') };
    const service = new PurchaseDraftService(companyId);
    res.json(await service.updateAndPost(id, input, currentUserId(req)));
  } catch (error) {
    next(error);
  }
});

purchasesRouter.post('/:id/cancel', requirePermission('purchases.edit'), async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const { id } = purchaseIdParams.parse(req.params);
    await assertWarehouseDocumentAccess(scope, 'purchase_invoices', id);
    const input = CancelPurchaseDraftInput.parse(req.body);
    const service = new PurchaseDraftService(companyId);
    res.json(await service.cancelDraft(id, input, currentUserId(req)));
  } catch (error) {
    next(error);
  }
});

purchasesRouter.post('/:id/post', requirePermission('purchases.edit'), async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const { id } = purchaseIdParams.parse(req.params);
    await assertWarehouseDocumentAccess(scope, 'purchase_invoices', id);
    const service = new PurchasePostService(companyId);
    res.json(await service.post(id, currentUserId(req)));
  } catch (error) {
    next(error);
  }
});

purchasesRouter.get('/:id', async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const { id } = purchaseIdParams.parse(req.params);
    await assertWarehouseDocumentAccess(scope, 'purchase_invoices', id);
    const service = new PurchaseDetailService(companyId);
    res.json(await service.getById(id));
  } catch (error) {
    next(error);
  }
});
