import { Router } from 'express';
import { resolveCompanyId } from '../http/company-context.js';
import {
  AvailableChequesQuery,
  CreateChequeBookInput,
  idParams,
  IssueChequeInput,
  ListChequeBooksQuery,
  ListChequesQuery,
  VoidChequeInput,
} from '../modules/bank-cheques/bank-cheque.schema.js';
import { BankChequeService } from '../modules/bank-cheques/bank-cheque.service.js';

export const bankChequesRouter = Router();

bankChequesRouter.get('/support-data', async (req, res, next) => {
  try {
    const service = new BankChequeService(resolveCompanyId(req));
    res.json(await service.supportData());
  } catch (error) {
    next(error);
  }
});

bankChequesRouter.get('/books', async (req, res, next) => {
  try {
    const service = new BankChequeService(resolveCompanyId(req));
    const query = ListChequeBooksQuery.parse(req.query);
    res.json(await service.listBooks(query));
  } catch (error) {
    next(error);
  }
});

bankChequesRouter.post('/books', async (req, res, next) => {
  try {
    const service = new BankChequeService(resolveCompanyId(req));
    const input = CreateChequeBookInput.parse(req.body);
    res.status(201).json(await service.createBook(input, req.header('x-user-id')));
  } catch (error) {
    next(error);
  }
});

bankChequesRouter.get('/available', async (req, res, next) => {
  try {
    const service = new BankChequeService(resolveCompanyId(req));
    const query = AvailableChequesQuery.parse(req.query);
    res.json(await service.availableCheques(query));
  } catch (error) {
    next(error);
  }
});

bankChequesRouter.get('/', async (req, res, next) => {
  try {
    const service = new BankChequeService(resolveCompanyId(req));
    const query = ListChequesQuery.parse(req.query);
    res.json(await service.listCheques(query));
  } catch (error) {
    next(error);
  }
});

bankChequesRouter.patch('/:id/void', async (req, res, next) => {
  try {
    const service = new BankChequeService(resolveCompanyId(req));
    const { id } = idParams.parse(req.params);
    const input = VoidChequeInput.parse(req.body);
    res.json(await service.voidCheque(id, input, req.header('x-user-id')));
  } catch (error) {
    next(error);
  }
});

bankChequesRouter.patch('/:id/issue', async (req, res, next) => {
  try {
    const service = new BankChequeService(resolveCompanyId(req));
    const { id } = idParams.parse(req.params);
    const input = IssueChequeInput.parse(req.body);
    res.json(await service.issueCheque(id, input, req.header('x-user-id')));
  } catch (error) {
    next(error);
  }
});
