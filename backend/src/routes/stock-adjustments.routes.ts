import { Router } from 'express';
import { resolveCompanyId } from '../http/company-context.js';
import { StockAdjustmentService } from '../modules/stock-adjustments/stock-adjustment.service.js';
import { idParams, ListStockAdjustmentsQuery, ValidateStockAdjustmentInput } from '../modules/stock-adjustments/stock-adjustment.schema.js';

export const stockAdjustmentsRouter = Router();

stockAdjustmentsRouter.get('/support-data', async (req, res, next) => {
  try {
    const service = new StockAdjustmentService(resolveCompanyId(req));
    res.json(await service.supportData());
  } catch (error) {
    next(error);
  }
});

stockAdjustmentsRouter.get('/', async (req, res, next) => {
  try {
    const service = new StockAdjustmentService(resolveCompanyId(req));
    const query = ListStockAdjustmentsQuery.parse(req.query);
    res.json(await service.list(query));
  } catch (error) {
    next(error);
  }
});

stockAdjustmentsRouter.post('/validate', async (req, res, next) => {
  try {
    const service = new StockAdjustmentService(resolveCompanyId(req));
    const input = ValidateStockAdjustmentInput.parse(req.body);
    res.json(await service.validate(input));
  } catch (error) {
    next(error);
  }
});

stockAdjustmentsRouter.post('/drafts', async (req, res, next) => {
  try {
    const service = new StockAdjustmentService(resolveCompanyId(req));
    const input = ValidateStockAdjustmentInput.parse(req.body);
    res.status(201).json(await service.createDraft(input, req.header('x-user-id')));
  } catch (error) {
    next(error);
  }
});

stockAdjustmentsRouter.post('/create-and-post', async (req, res, next) => {
  try {
    const service = new StockAdjustmentService(resolveCompanyId(req));
    const input = ValidateStockAdjustmentInput.parse(req.body);
    res.status(201).json(await service.createAndPost(input, req.header('x-user-id')));
  } catch (error) {
    next(error);
  }
});

stockAdjustmentsRouter.post('/:id/post', async (req, res, next) => {
  try {
    const service = new StockAdjustmentService(resolveCompanyId(req));
    const { id } = idParams.parse(req.params);
    res.json(await service.post(id, req.header('x-user-id')));
  } catch (error) {
    next(error);
  }
});

stockAdjustmentsRouter.get('/:id', async (req, res, next) => {
  try {
    const service = new StockAdjustmentService(resolveCompanyId(req));
    const { id } = idParams.parse(req.params);
    res.json(await service.getById(id));
  } catch (error) {
    next(error);
  }
});
