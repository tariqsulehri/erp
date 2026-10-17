import { Router } from 'express';
import { resolveCompanyId } from '../http/company-context.js';
import { StockTransferService } from '../modules/stock-transfers/stock-transfer.service.js';
import { idParams, ListStockTransfersQuery, ValidateStockTransferInput } from '../modules/stock-transfers/stock-transfer.schema.js';

export const stockTransfersRouter = Router();

stockTransfersRouter.get('/support-data', async (req, res, next) => {
  try {
    const service = new StockTransferService(resolveCompanyId(req));
    res.json(await service.supportData());
  } catch (error) {
    next(error);
  }
});

stockTransfersRouter.get('/', async (req, res, next) => {
  try {
    const service = new StockTransferService(resolveCompanyId(req));
    const query = ListStockTransfersQuery.parse(req.query);
    res.json(await service.list(query));
  } catch (error) {
    next(error);
  }
});

stockTransfersRouter.post('/validate', async (req, res, next) => {
  try {
    const service = new StockTransferService(resolveCompanyId(req));
    const input = ValidateStockTransferInput.parse(req.body);
    res.json(await service.validate(input));
  } catch (error) {
    next(error);
  }
});

stockTransfersRouter.post('/drafts', async (req, res, next) => {
  try {
    const service = new StockTransferService(resolveCompanyId(req));
    const input = ValidateStockTransferInput.parse(req.body);
    res.status(201).json(await service.createDraft(input, req.header('x-user-id')));
  } catch (error) {
    next(error);
  }
});

stockTransfersRouter.post('/create-and-post', async (req, res, next) => {
  try {
    const service = new StockTransferService(resolveCompanyId(req));
    const input = ValidateStockTransferInput.parse(req.body);
    res.status(201).json(await service.createAndPost(input, req.header('x-user-id')));
  } catch (error) {
    next(error);
  }
});

stockTransfersRouter.post('/:id/post', async (req, res, next) => {
  try {
    const service = new StockTransferService(resolveCompanyId(req));
    const { id } = idParams.parse(req.params);
    res.json(await service.post(id, req.header('x-user-id')));
  } catch (error) {
    next(error);
  }
});

stockTransfersRouter.get('/:id', async (req, res, next) => {
  try {
    const service = new StockTransferService(resolveCompanyId(req));
    const { id } = idParams.parse(req.params);
    res.json(await service.getById(id));
  } catch (error) {
    next(error);
  }
});
