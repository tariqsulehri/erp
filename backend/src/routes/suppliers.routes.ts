import { Router } from 'express';
import { z } from 'zod';
import { resolveCompanyId } from '../http/company-context.js';
import { partyListQuerySchema, supplierInputSchema, updateSupplierInputSchema } from '../modules/parties/party.schema.js';
import { SupplierService } from '../modules/parties/supplier.service.js';

export const suppliersRouter = Router();

const supplierService = new SupplierService();

suppliersRouter.get('/', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const query = partyListQuerySchema.parse(req.query);
    res.json(await supplierService.list(companyId, query));
  } catch (error) {
    next(error);
  }
});

suppliersRouter.get('/stats', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    res.json(await supplierService.stats(companyId));
  } catch (error) {
    next(error);
  }
});

suppliersRouter.get('/next-code', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    res.json(await supplierService.nextCode(companyId));
  } catch (error) {
    next(error);
  }
});

suppliersRouter.get('/accounts', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    res.json(await supplierService.listAccounts(companyId));
  } catch (error) {
    next(error);
  }
});

suppliersRouter.post('/', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const input = supplierInputSchema.parse(req.body);
    res.status(201).json(await supplierService.create(companyId, input));
  } catch (error) {
    next(error);
  }
});

suppliersRouter.patch('/:id', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const id = z.string().uuid().parse(req.params.id);
    const input = updateSupplierInputSchema.parse(req.body);
    res.json(await supplierService.update(companyId, id, input));
  } catch (error) {
    next(error);
  }
});

suppliersRouter.delete('/:id', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const id = z.string().uuid().parse(req.params.id);
    await supplierService.deactivate(companyId, id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});
