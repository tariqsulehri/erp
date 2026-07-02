import { Router } from 'express';
import { z } from 'zod';
import { resolveCompanyId } from '../http/company-context.js';
import { CustomerService } from '../modules/parties/customer.service.js';
import { customerInputSchema, partyListQuerySchema, updateCustomerInputSchema } from '../modules/parties/party.schema.js';

export const customersRouter = Router();

const customerService = new CustomerService();

customersRouter.get('/', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const query = partyListQuerySchema.parse(req.query);
    res.json(await customerService.list(companyId, query));
  } catch (error) {
    next(error);
  }
});

customersRouter.get('/stats', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    res.json(await customerService.stats(companyId));
  } catch (error) {
    next(error);
  }
});

customersRouter.get('/next-code', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    res.json(await customerService.nextCode(companyId));
  } catch (error) {
    next(error);
  }
});

customersRouter.get('/accounts', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    res.json(await customerService.listAccounts(companyId));
  } catch (error) {
    next(error);
  }
});

customersRouter.post('/', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const input = customerInputSchema.parse(req.body);
    res.status(201).json(await customerService.create(companyId, input));
  } catch (error) {
    next(error);
  }
});

customersRouter.patch('/:id', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const id = z.string().uuid().parse(req.params.id);
    const input = updateCustomerInputSchema.parse(req.body);
    res.json(await customerService.update(companyId, id, input));
  } catch (error) {
    next(error);
  }
});

customersRouter.delete('/:id', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const id = z.string().uuid().parse(req.params.id);
    await customerService.deactivate(companyId, id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});
