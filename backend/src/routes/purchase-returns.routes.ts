import { Router } from 'express';
import { z } from 'zod';
import { resolveCompanyId } from '../http/company-context.js';
import { PurchaseReturnDetailService } from '../modules/purchase-returns/purchase-return-detail.service.js';
import { PurchaseReturnDraftService } from '../modules/purchase-returns/purchase-return-draft.service.js';
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
    const companyId = resolveCompanyId(req);
    const query = ListPurchaseReturnsQuery.parse(req.query);
    const service = new PurchaseReturnListService(companyId);
    res.json(await service.list(query));
  } catch (error) {
    next(error);
  }
});

purchaseReturnsRouter.get('/support-data', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const service = new PurchaseSupportService(companyId);
    res.json(await service.getSupportData());
  } catch (error) {
    next(error);
  }
});

purchaseReturnsRouter.post('/validate', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const input = ValidatePurchaseReturnInput.parse(req.body);
    const service = new PurchaseReturnValidationService(companyId);
    res.json(await service.validate(input));
  } catch (error) {
    next(error);
  }
});

purchaseReturnsRouter.post('/drafts', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const input = ValidatePurchaseReturnInput.parse(req.body);
    const service = new PurchaseReturnDraftService(companyId);
    res.status(201).json(await service.createDraft(input, req.header('x-user-id')));
  } catch (error) {
    next(error);
  }
});

purchaseReturnsRouter.post('/create-and-post', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const input = ValidatePurchaseReturnInput.parse(req.body);
    const userId = req.header('x-user-id');
    const draftService = new PurchaseReturnDraftService(companyId);
    const postService = new PurchaseReturnPostService(companyId);
    const draft = await draftService.createDraft(input, userId);
    res.status(201).json(await postService.post(draft.id, userId));
  } catch (error) {
    next(error);
  }
});

purchaseReturnsRouter.post('/:id/post', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const { id } = purchaseReturnIdParams.parse(req.params);
    const service = new PurchaseReturnPostService(companyId);
    res.json(await service.post(id, req.header('x-user-id')));
  } catch (error) {
    next(error);
  }
});

purchaseReturnsRouter.get('/:id', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const { id } = purchaseReturnIdParams.parse(req.params);
    const service = new PurchaseReturnDetailService(companyId);
    res.json(await service.getById(id));
  } catch (error) {
    next(error);
  }
});
