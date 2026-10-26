import { Router } from 'express';
import { requirePermission } from '../http/access-context.js';
import { resolveCompanyId } from '../http/company-context.js';
import { StateService } from '../modules/states/state.service.js';
import { createStateSchema, idParams, listStatesQuery, updateStateSchema } from '../modules/states/state.schema.js';

export const statesRouter = Router();

statesRouter.get('/', async (req, res, next) => {
  try {
    const service = new StateService(resolveCompanyId(req));
    const query = listStatesQuery.parse(req.query);
    res.json(await service.list(query));
  } catch (error) {
    next(error);
  }
});

statesRouter.post('/', requirePermission('locations.manage'), async (req, res, next) => {
  try {
    const service = new StateService(resolveCompanyId(req));
    const body = createStateSchema.parse(req.body);
    res.status(201).json(await service.create(body));
  } catch (error) {
    next(error);
  }
});

statesRouter.get('/:id', async (req, res, next) => {
  try {
    const service = new StateService(resolveCompanyId(req));
    const { id } = idParams.parse(req.params);
    const state = await service.getById(id);
    if (!state) {
      const error = new Error('State not found.');
      Object.assign(error, { statusCode: 404 });
      throw error;
    }
    res.json(state);
  } catch (error) {
    next(error);
  }
});

statesRouter.patch('/:id', requirePermission('locations.manage'), async (req, res, next) => {
  try {
    const service = new StateService(resolveCompanyId(req));
    const { id } = idParams.parse(req.params);
    const body = updateStateSchema.parse({ ...req.body, id });
    res.json(await service.update(body));
  } catch (error) {
    next(error);
  }
});
