import { Router } from 'express';
import type { Request } from 'express';
import { currentUserId, resolveAccessScope } from '../http/access-context.js';
import { StockAdjustmentService } from '../modules/stock-adjustments/stock-adjustment.service.js';
import { idParams, ListStockAdjustmentsQuery, ValidateStockAdjustmentInput } from '../modules/stock-adjustments/stock-adjustment.schema.js';

export const stockAdjustmentsRouter = Router();

/** Limits every adjustment call to what the signed-in user's Branch / Warehouse may see and change. */
function serviceFor(req: Request) {
  const scope = resolveAccessScope(req);
  return new StockAdjustmentService(scope.companyId, scope);
}

stockAdjustmentsRouter.get('/support-data', async (req, res, next) => {
  try {
    const service = serviceFor(req);
    res.json(await service.supportData());
  } catch (error) {
    next(error);
  }
});

stockAdjustmentsRouter.get('/', async (req, res, next) => {
  try {
    const service = serviceFor(req);
    const query = ListStockAdjustmentsQuery.parse(req.query);
    res.json(await service.list(query));
  } catch (error) {
    next(error);
  }
});

stockAdjustmentsRouter.post('/validate', async (req, res, next) => {
  try {
    const service = serviceFor(req);
    const input = ValidateStockAdjustmentInput.parse(req.body);
    res.json(await service.validate(input));
  } catch (error) {
    next(error);
  }
});

stockAdjustmentsRouter.post('/drafts', async (req, res, next) => {
  try {
    const service = serviceFor(req);
    const input = ValidateStockAdjustmentInput.parse(req.body);
    res.status(201).json(await service.createDraft(input, currentUserId(req)));
  } catch (error) {
    next(error);
  }
});

stockAdjustmentsRouter.post('/create-and-post', async (req, res, next) => {
  try {
    const service = serviceFor(req);
    const input = ValidateStockAdjustmentInput.parse(req.body);
    res.status(201).json(await service.createAndPost(input, currentUserId(req)));
  } catch (error) {
    next(error);
  }
});

stockAdjustmentsRouter.post('/:id/post', async (req, res, next) => {
  try {
    const service = serviceFor(req);
    const { id } = idParams.parse(req.params);
    res.json(await service.post(id, currentUserId(req)));
  } catch (error) {
    next(error);
  }
});

stockAdjustmentsRouter.get('/:id', async (req, res, next) => {
  try {
    const service = serviceFor(req);
    const { id } = idParams.parse(req.params);
    res.json(await service.getById(id));
  } catch (error) {
    next(error);
  }
});
