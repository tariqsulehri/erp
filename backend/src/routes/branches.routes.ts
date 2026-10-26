import { Router } from 'express';
import { requirePermission, resolveAccessScope } from '../http/access-context.js';
import { resolveCompanyId } from '../http/company-context.js';
import { branchHolder } from '../modules/inventory/stock-holder.js';
import { assertCanUseHolder } from '../modules/inventory/stock-holder-access.js';
import { holderStockSummary } from '../modules/inventory/stock-summary.service.js';
import { listWarehouseStockQuery } from '../modules/inventory/warehouse.schema.js';
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

branchesRouter.post('/', requirePermission('organization.manage'), async (req, res, next) => {
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

branchesRouter.patch('/:id', requirePermission('organization.manage'), async (req, res, next) => {
  try {
    const service = new BranchService(resolveCompanyId(req));
    const { id } = idParams.parse(req.params);
    const body = updateBranchSchema.parse({ ...req.body, id });
    res.json(await service.update(body));
  } catch (error) {
    next(error);
  }
});

// Item stock held at one Branch. Branch users can open only their own Branch.
branchesRouter.get('/:id/stock-summary', async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const { id } = idParams.parse(req.params);
    assertCanUseHolder(scope, branchHolder(id), 'view stock');
    const service = new BranchService(scope.companyId);
    if (!(await service.getById(id))) {
      const error = new Error('Branch not found.');
      Object.assign(error, { statusCode: 404 });
      throw error;
    }
    res.json(await holderStockSummary(scope.companyId, { kind: 'BRANCH', id }, listWarehouseStockQuery.parse(req.query)));
  } catch (error) {
    next(error);
  }
});
