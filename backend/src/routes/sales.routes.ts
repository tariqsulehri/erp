import { Router } from 'express';
import { z } from 'zod';
import { resolveCompanyId } from '../http/company-context.js';
import { SaleDetailService } from '../modules/sales/sale-detail.service.js';
import { SaleDraftService } from '../modules/sales/sale-draft.service.js';
import { ListSaleInvoicesQuery, SaleListService } from '../modules/sales/sale-list.service.js';
import { SalePostService } from '../modules/sales/sale-post.service.js';
import { SaleSupportService } from '../modules/sales/sale-support.service.js';
import { SaleValidationService, ValidateSaleInvoiceInput } from '../modules/sales/sale-validation.service.js';

export const salesRouter = Router();

const saleIdParams = z.object({
  id: z.string().uuid(),
});

salesRouter.get('/', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const query = ListSaleInvoicesQuery.parse(req.query);
    const service = new SaleListService(companyId);
    res.json(await service.list(query));
  } catch (error) {
    next(error);
  }
});

salesRouter.get('/support-data', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const service = new SaleSupportService(companyId);
    res.json(await service.getSupportData());
  } catch (error) {
    next(error);
  }
});

salesRouter.post('/validate', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const input = ValidateSaleInvoiceInput.parse(req.body);
    const service = new SaleValidationService(companyId);
    res.json(await service.validate(input));
  } catch (error) {
    next(error);
  }
});

salesRouter.post('/drafts', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const input = ValidateSaleInvoiceInput.parse(req.body);
    const service = new SaleDraftService(companyId);
    res.status(201).json(await service.createDraft(input, req.header('x-user-id')));
  } catch (error) {
    next(error);
  }
});

salesRouter.post('/create-and-post', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const input = ValidateSaleInvoiceInput.parse(req.body);
    const userId = req.header('x-user-id');
    const draftService = new SaleDraftService(companyId);
    const postService = new SalePostService(companyId);
    const draft = await draftService.createDraft(input, userId);
    res.status(201).json(await postService.post(draft.id, userId));
  } catch (error) {
    next(error);
  }
});

salesRouter.post('/:id/post', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const { id } = saleIdParams.parse(req.params);
    const service = new SalePostService(companyId);
    res.json(await service.post(id, req.header('x-user-id')));
  } catch (error) {
    next(error);
  }
});

salesRouter.get('/:id', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const { id } = saleIdParams.parse(req.params);
    const service = new SaleDetailService(companyId);
    res.json(await service.getById(id));
  } catch (error) {
    next(error);
  }
});
