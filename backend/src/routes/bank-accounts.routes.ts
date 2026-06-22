import { Router } from 'express';
import { resolveCompanyId } from '../http/company-context.js';
import { BankAccountService } from '../modules/bank-accounts/bank-account.service.js';
import { BankAccountInput, BankAccountUpdateInput, idParams, ListBankAccountsQuery } from '../modules/bank-accounts/bank-account.schema.js';

export const bankAccountsRouter = Router();

bankAccountsRouter.get('/support-data', async (req, res, next) => {
  try {
    const service = new BankAccountService(resolveCompanyId(req));
    res.json(await service.supportData());
  } catch (error) {
    next(error);
  }
});

bankAccountsRouter.get('/', async (req, res, next) => {
  try {
    const service = new BankAccountService(resolveCompanyId(req));
    const query = ListBankAccountsQuery.parse(req.query);
    res.json(await service.list(query));
  } catch (error) {
    next(error);
  }
});

bankAccountsRouter.post('/', async (req, res, next) => {
  try {
    const service = new BankAccountService(resolveCompanyId(req));
    const input = BankAccountInput.parse(req.body);
    res.status(201).json(await service.create(input, req.header('x-user-id')));
  } catch (error) {
    next(error);
  }
});

bankAccountsRouter.patch('/:id', async (req, res, next) => {
  try {
    const service = new BankAccountService(resolveCompanyId(req));
    const { id } = idParams.parse(req.params);
    const input = BankAccountUpdateInput.parse(req.body);
    res.json(await service.update(id, input, req.header('x-user-id')));
  } catch (error) {
    next(error);
  }
});
