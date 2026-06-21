import { Router } from 'express';
import { resolveCompanyId } from '../http/company-context.js';
import { PurchaseAnalyticsQuery, PurchaseAnalyticsService } from '../modules/purchases/purchase-analytics.service.js';
import { PurchaseDetailService } from '../modules/purchases/purchase-detail.service.js';
import { PurchaseDraftService } from '../modules/purchases/purchase-draft.service.js';
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
    const companyId = resolveCompanyId(req);
    const query = ListPurchaseInvoicesQuery.parse(req.query);
    const service = new PurchaseListService(companyId);
    res.json(await service.list(query));
  } catch (error) {
    next(error);
  }
});

purchasesRouter.get('/analytics', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const query = PurchaseAnalyticsQuery.parse(req.query);
    const service = new PurchaseAnalyticsService(companyId);
    res.json(await service.analytics(query));
  } catch (error) {
    next(error);
  }
});

purchasesRouter.get('/support-data', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const service = new PurchaseSupportService(companyId);
    res.json(await service.getSupportData());
  } catch (error) {
    next(error);
  }
});

purchasesRouter.post('/validate', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const input = ValidatePurchaseInvoiceInput.parse(req.body);
    const service = new PurchaseValidationService(companyId);
    res.json(await service.validate(input));
  } catch (error) {
    next(error);
  }
});

purchasesRouter.post('/drafts', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const input = ValidatePurchaseInvoiceInput.parse(req.body);
    const service = new PurchaseDraftService(companyId);
    res.status(201).json(await service.createDraft(input, req.header('x-user-id')));
  } catch (error) {
    next(error);
  }
});

purchasesRouter.post('/create-and-post', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const input = ValidatePurchaseInvoiceInput.parse(req.body);
    const userId = req.header('x-user-id');
    const draftService = new PurchaseDraftService(companyId);
    const postService = new PurchasePostService(companyId);
    const draft = await draftService.createDraft(input, userId);
    res.status(201).json(await postService.post(draft.id, userId));
  } catch (error) {
    next(error);
  }
});

purchasesRouter.post('/:id/post', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const { id } = purchaseIdParams.parse(req.params);
    const service = new PurchasePostService(companyId);
    res.json(await service.post(id, req.header('x-user-id')));
  } catch (error) {
    next(error);
  }
});

purchasesRouter.get('/:id', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const { id } = purchaseIdParams.parse(req.params);
    const service = new PurchaseDetailService(companyId);
    res.json(await service.getById(id));
  } catch (error) {
    next(error);
  }
});
