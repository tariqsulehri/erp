import { Router } from 'express';
import type { Request } from 'express';
import { currentUserId, resolveAccessScope, requirePermission } from '../http/access-context.js';
import { holderFromColumns } from '../modules/inventory/stock-holder.js';
import { StockTransferService } from '../modules/stock-transfers/stock-transfer.service.js';
import {
  idParams,
  ListStockTransfersQuery,
  ValidateStockTransferInput,
  SupportDataQuery,
  SourceStockQuery,
} from '../modules/stock-transfers/stock-transfer.schema.js';

export const stockTransfersRouter = Router();

/** Every transfer service call is limited to what the signed-in user's Branch / Warehouse may see and send. */
function serviceFor(req: Request) {
  const scope = resolveAccessScope(req);
  return new StockTransferService(scope.companyId, scope);
}

stockTransfersRouter.get('/support-data', async (req, res, next) => {
  try {
    const service = serviceFor(req);
    const query = SupportDataQuery.parse(req.query);
    res.json(await service.supportData(query));
  } catch (error) {
    next(error);
  }
});

stockTransfersRouter.get('/source-stock', async (req, res, next) => {
  try {
    const service = serviceFor(req);
    const query = SourceStockQuery.parse(req.query);
    res.json(await service.getSourceStock(holderFromColumns(query.branch_id || null, query.warehouse_id || null, query.location_id || null)));
  } catch (error) {
    next(error);
  }
});

stockTransfersRouter.get('/', async (req, res, next) => {
  try {
    const service = serviceFor(req);
    const query = ListStockTransfersQuery.parse(req.query);
    res.json(await service.list(query));
  } catch (error) {
    next(error);
  }
});

stockTransfersRouter.post('/validate', requirePermission('stock_transfers.edit'), async (req, res, next) => {
  try {
    const service = serviceFor(req);
    const input = ValidateStockTransferInput.parse(req.body);
    res.json(await service.validate(input));
  } catch (error) {
    next(error);
  }
});

stockTransfersRouter.post('/drafts', requirePermission('stock_transfers.edit'), async (req, res, next) => {
  try {
    const service = serviceFor(req);
    const input = ValidateStockTransferInput.parse(req.body);
    res.status(201).json(await service.createDraft(input, currentUserId(req)));
  } catch (error) {
    next(error);
  }
});

stockTransfersRouter.post('/create-and-post', requirePermission('stock_transfers.edit'), async (req, res, next) => {
  try {
    const service = serviceFor(req);
    const input = ValidateStockTransferInput.parse(req.body);
    res.status(201).json(await service.createAndPost(input, currentUserId(req)));
  } catch (error) {
    next(error);
  }
});

stockTransfersRouter.post('/:id/post', requirePermission('stock_transfers.edit'), async (req, res, next) => {
  try {
    const service = serviceFor(req);
    const { id } = idParams.parse(req.params);
    res.json(await service.post(id, currentUserId(req)));
  } catch (error) {
    next(error);
  }
});

stockTransfersRouter.get('/:id', async (req, res, next) => {
  try {
    const service = serviceFor(req);
    const { id } = idParams.parse(req.params);
    res.json(await service.getById(id));
  } catch (error) {
    next(error);
  }
});
