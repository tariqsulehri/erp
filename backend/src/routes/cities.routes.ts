import { Router } from 'express';
import { requirePermission } from '../http/access-context.js';
import { resolveCompanyId } from '../http/company-context.js';
import { CityService } from '../modules/cities/city.service.js';
import { createCitySchema, idParams, listCitiesQuery, updateCitySchema } from '../modules/cities/city.schema.js';

export const citiesRouter = Router();

citiesRouter.get('/', async (req, res, next) => {
  try {
    const service = new CityService(resolveCompanyId(req));
    const query = listCitiesQuery.parse(req.query);
    res.json(await service.list(query));
  } catch (error) {
    next(error);
  }
});

citiesRouter.post('/', requirePermission('locations.manage'), async (req, res, next) => {
  try {
    const service = new CityService(resolveCompanyId(req));
    const body = createCitySchema.parse(req.body);
    res.status(201).json(await service.create(body));
  } catch (error) {
    next(error);
  }
});

citiesRouter.get('/:id', async (req, res, next) => {
  try {
    const service = new CityService(resolveCompanyId(req));
    const { id } = idParams.parse(req.params);
    const city = await service.getById(id);
    if (!city) {
      const error = new Error('City not found.');
      Object.assign(error, { statusCode: 404 });
      throw error;
    }
    res.json(city);
  } catch (error) {
    next(error);
  }
});

citiesRouter.patch('/:id', requirePermission('locations.manage'), async (req, res, next) => {
  try {
    const service = new CityService(resolveCompanyId(req));
    const { id } = idParams.parse(req.params);
    const body = updateCitySchema.parse({ ...req.body, id });
    res.json(await service.update(body));
  } catch (error) {
    next(error);
  }
});
