import { Router } from 'express';
import { requirePermission } from '../http/access-context.js';
import { resolveCompanyId } from '../http/company-context.js';
import { AreaService } from '../modules/areas/area.service.js';
import { createAreaSchema, idParams, listAreasQuery, updateAreaSchema } from '../modules/areas/area.schema.js';

export const areasRouter = Router();

areasRouter.get('/', async (req, res, next) => {
  try {
    const service = new AreaService(resolveCompanyId(req));
    const query = listAreasQuery.parse(req.query);
    res.json(await service.list(query));
  } catch (error) {
    next(error);
  }
});

areasRouter.post('/', requirePermission('locations.manage'), async (req, res, next) => {
  try {
    const service = new AreaService(resolveCompanyId(req));
    const body = createAreaSchema.parse(req.body);
    res.status(201).json(await service.create(body));
  } catch (error) {
    next(error);
  }
});

areasRouter.get('/:id', async (req, res, next) => {
  try {
    const service = new AreaService(resolveCompanyId(req));
    const { id } = idParams.parse(req.params);
    const area = await service.getById(id);
    if (!area) {
      const error = new Error('Area not found.');
      Object.assign(error, { statusCode: 404 });
      throw error;
    }
    res.json(area);
  } catch (error) {
    next(error);
  }
});

areasRouter.patch('/:id', requirePermission('locations.manage'), async (req, res, next) => {
  try {
    const service = new AreaService(resolveCompanyId(req));
    const { id } = idParams.parse(req.params);
    const body = updateAreaSchema.parse({ ...req.body, id });
    res.json(await service.update(body));
  } catch (error) {
    next(error);
  }
});
