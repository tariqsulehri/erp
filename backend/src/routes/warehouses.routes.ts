import { Router } from 'express';
import { resolveCompanyId } from '../http/company-context.js';
import { WarehouseService } from '../modules/inventory/warehouse.service.js';
import {
  createWarehouseLocationSchema,
  createWarehouseSchema,
  idParams,
  listWarehousesQuery,
  listWarehouseStockQuery,
  locationIdParams,
  updateWarehouseLocationSchema,
  updateWarehouseSchema,
} from '../modules/inventory/warehouse.schema.js';

export const warehousesRouter = Router();

warehousesRouter.get('/', async (req, res, next) => {
  try {
    const service = new WarehouseService(resolveCompanyId(req));
    const query = listWarehousesQuery.parse(req.query);
    res.json(await service.list(query));
  } catch (error) {
    next(error);
  }
});

warehousesRouter.post('/', async (req, res, next) => {
  try {
    const service = new WarehouseService(resolveCompanyId(req));
    const body = createWarehouseSchema.parse(req.body);
    res.status(201).json(await service.create(body));
  } catch (error) {
    next(error);
  }
});

warehousesRouter.patch('/locations/:locationId', async (req, res, next) => {
  try {
    const service = new WarehouseService(resolveCompanyId(req));
    const { locationId } = locationIdParams.parse(req.params);
    const body = updateWarehouseLocationSchema.parse({ ...req.body, id: locationId });
    res.json(await service.updateLocation(body));
  } catch (error) {
    next(error);
  }
});

warehousesRouter.get('/:id', async (req, res, next) => {
  try {
    const service = new WarehouseService(resolveCompanyId(req));
    const { id } = idParams.parse(req.params);
    const warehouse = await service.getById(id);
    if (!warehouse) {
      const error = new Error('Warehouse not found.');
      Object.assign(error, { statusCode: 404 });
      throw error;
    }
    res.json(warehouse);
  } catch (error) {
    next(error);
  }
});

warehousesRouter.patch('/:id', async (req, res, next) => {
  try {
    const service = new WarehouseService(resolveCompanyId(req));
    const { id } = idParams.parse(req.params);
    const body = updateWarehouseSchema.parse({ ...req.body, id });
    res.json(await service.update(body));
  } catch (error) {
    next(error);
  }
});

warehousesRouter.get('/:id/locations', async (req, res, next) => {
  try {
    const service = new WarehouseService(resolveCompanyId(req));
    const { id } = idParams.parse(req.params);
    res.json(await service.listLocations(id));
  } catch (error) {
    next(error);
  }
});

warehousesRouter.post('/:id/locations', async (req, res, next) => {
  try {
    const service = new WarehouseService(resolveCompanyId(req));
    const { id } = idParams.parse(req.params);
    const body = createWarehouseLocationSchema.parse(req.body);
    res.status(201).json(await service.createLocation(id, body));
  } catch (error) {
    next(error);
  }
});

warehousesRouter.get('/:id/stock-summary', async (req, res, next) => {
  try {
    const service = new WarehouseService(resolveCompanyId(req));
    const { id } = idParams.parse(req.params);
    const query = listWarehouseStockQuery.parse(req.query);
    res.json(await service.stockSummary(id, query));
  } catch (error) {
    next(error);
  }
});
