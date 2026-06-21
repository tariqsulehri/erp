import { Router } from 'express';
import { z } from 'zod';
import { resolveCompanyId } from '../http/company-context.js';
import { SaleReturnDetailService } from '../modules/sale-returns/sale-return-detail.service.js';
import { SaleReturnDraftService } from '../modules/sale-returns/sale-return-draft.service.js';
import { ListSaleReturnsQuery, SaleReturnListService } from '../modules/sale-returns/sale-return-list.service.js';
import { SaleReturnPostService } from '../modules/sale-returns/sale-return-post.service.js';
import { SaleReturnValidationService, ValidateSaleReturnInput } from '../modules/sale-returns/sale-return-validation.service.js';
import { SaleSupportService } from '../modules/sales/sale-support.service.js';

export const saleReturnsRouter = Router();

const saleReturnIdParams = z.object({
  id: z.string().uuid(),
});

saleReturnsRouter.get('/', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const query = ListSaleReturnsQuery.parse(req.query);
    const service = new SaleReturnListService(companyId);
    res.json(await service.list(query));
  } catch (error) {
    next(error);
  }
});

saleReturnsRouter.get('/support-data', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const service = new SaleSupportService(companyId);
    res.json(await service.getSupportData());
  } catch (error) {
    next(error);
  }
});

saleReturnsRouter.post('/validate', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const input = ValidateSaleReturnInput.parse(req.body);
    const service = new SaleReturnValidationService(companyId);
    res.json(await service.validate(input));
  } catch (error) {
    next(error);
  }
});

saleReturnsRouter.post('/drafts', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const input = ValidateSaleReturnInput.parse(req.body);
    const service = new SaleReturnDraftService(companyId);
    res.status(201).json(await service.createDraft(input, req.header('x-user-id')));
  } catch (error) {
    next(error);
  }
});

saleReturnsRouter.post('/create-and-post', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const input = ValidateSaleReturnInput.parse(req.body);
    const userId = req.header('x-user-id');
    const draftService = new SaleReturnDraftService(companyId);
    const postService = new SaleReturnPostService(companyId);
    const draft = await draftService.createDraft(input, userId);
    res.status(201).json(await postService.post(draft.id, userId));
  } catch (error) {
    next(error);
  }
});

saleReturnsRouter.post('/:id/post', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const { id } = saleReturnIdParams.parse(req.params);
    const service = new SaleReturnPostService(companyId);
    res.json(await service.post(id, req.header('x-user-id')));
  } catch (error) {
    next(error);
  }
});

saleReturnsRouter.get('/:id', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const { id } = saleReturnIdParams.parse(req.params);
    const service = new SaleReturnDetailService(companyId);
    res.json(await service.getById(id));
  } catch (error) {
    next(error);
  }
});
