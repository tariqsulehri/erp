import { Router } from 'express';
import { resolveCompanyId } from '../http/company-context.js';
import { BranchService } from '../modules/branches/branch.service.js';
import { createBranchSchema, idParams, listBranchesQuery, updateBranchSchema } from '../modules/branches/branch.schema.js';

export const branchesRouter = Router();

branchesRouter.get('/', async (req, res, next) => {
  try {
    const service = new BranchService(resolveCompanyId(req));
    const query = listBranchesQuery.parse(req.query);
    res.json(await service.list(query));
  } catch (error) {
    next(error);
  }
});

branchesRouter.post('/', async (req, res, next) => {
  try {
    const service = new BranchService(resolveCompanyId(req));
    const body = createBranchSchema.parse(req.body);
    res.status(201).json(await service.create(body));
  } catch (error) {
    next(error);
  }
});

branchesRouter.get('/:id', async (req, res, next) => {
  try {
    const service = new BranchService(resolveCompanyId(req));
    const { id } = idParams.parse(req.params);
    const branch = await service.getById(id);
    if (!branch) {
      const error = new Error('Branch not found.');
      Object.assign(error, { statusCode: 404 });
      throw error;
    }
    res.json(branch);
  } catch (error) {
    next(error);
  }
});

branchesRouter.patch('/:id', async (req, res, next) => {
  try {
    const service = new BranchService(resolveCompanyId(req));
    const { id } = idParams.parse(req.params);
    const body = updateBranchSchema.parse({ ...req.body, id });
    res.json(await service.update(body));
  } catch (error) {
    next(error);
  }
});
