import { Router } from 'express';
import type { Request } from 'express';
import { currentUserId, resolveAccessScope, requirePermission } from '../http/access-context.js';
import { StockAdjustmentService } from '../modules/stock-adjustments/stock-adjustment.service.js';
import { CancelStockAdjustmentDraftInput, idParams, ListStockAdjustmentsQuery, ReverseStockDocumentInput, ValidateStockAdjustmentInput } from '../modules/stock-adjustments/stock-adjustment.schema.js';

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

stockAdjustmentsRouter.post('/validate', requirePermission('stock_adjustments.edit'), async (req, res, next) => {
  try {
    const service = serviceFor(req);
    const input = ValidateStockAdjustmentInput.parse(req.body);
    res.json(await service.validate(input));
  } catch (error) {
    next(error);
  }
});

stockAdjustmentsRouter.post('/drafts', requirePermission('stock_adjustments.edit'), async (req, res, next) => {
  try {
    const service = serviceFor(req);
    const input = ValidateStockAdjustmentInput.parse(req.body);
    res.status(201).json(await service.createDraft(input, currentUserId(req)));
  } catch (error) {
    next(error);
  }
});

stockAdjustmentsRouter.post('/create-and-post', requirePermission('stock_adjustments.edit'), async (req, res, next) => {
  try {
    const service = serviceFor(req);
    const input = ValidateStockAdjustmentInput.parse(req.body);
    res.status(201).json(await service.createAndPost(input, currentUserId(req)));
  } catch (error) {
    next(error);
  }
});

stockAdjustmentsRouter.put('/:id', requirePermission('stock_adjustments.edit'), async (req, res, next) => {
  try {
    const service = serviceFor(req);
    const { id } = idParams.parse(req.params);
    const input = ValidateStockAdjustmentInput.parse(req.body);
    res.json(await service.updateDraft(id, input, currentUserId(req)));
  } catch (error) {
    next(error);
  }
});

stockAdjustmentsRouter.post('/:id/update-and-post', requirePermission('stock_adjustments.edit'), async (req, res, next) => {
  try {
    const service = serviceFor(req);
    const { id } = idParams.parse(req.params);
    const input = ValidateStockAdjustmentInput.parse(req.body);
    res.json(await service.updateAndPost(id, input, currentUserId(req)));
  } catch (error) {
    next(error);
  }
});

stockAdjustmentsRouter.post('/:id/cancel', requirePermission('stock_adjustments.edit'), async (req, res, next) => {
  try {
    const service = serviceFor(req);
    const { id } = idParams.parse(req.params);
    const input = CancelStockAdjustmentDraftInput.parse(req.body);
    res.json(await service.cancelDraft(id, input, currentUserId(req)));
  } catch (error) {
    next(error);
  }
});

stockAdjustmentsRouter.post('/:id/post', requirePermission('stock_adjustments.edit'), async (req, res, next) => {
  try {
    const service = serviceFor(req);
    const { id } = idParams.parse(req.params);
    res.json(await service.post(id, currentUserId(req)));
  } catch (error) {
    next(error);
  }
});

stockAdjustmentsRouter.post('/:id/reverse', requirePermission('stock.reverse'), async (req, res, next) => {
  try {
    const service = serviceFor(req);
    const { id } = idParams.parse(req.params);
    const input = ReverseStockDocumentInput.parse(req.body);
    res.json(await service.reverse(id, input, currentUserId(req)));
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
