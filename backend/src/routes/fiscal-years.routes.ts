import { Router } from 'express';
import { z } from 'zod';
import { resolveCompanyId } from '../http/company-context.js';
import { FiscalYearService } from '../modules/fiscal-years/fiscal-year.service.js';
import {
  closingIssuesQuery,
  closeFiscalYearSchema,
  createFiscalYearSchema,
  fiscalYearIdParams,
  listFiscalYearsQuery,
  periodIdParams,
} from '../modules/fiscal-years/fiscal-year.schema.js';
import { PostingDateService } from '../modules/fiscal-years/posting-date.service.js';

export const fiscalYearsRouter = Router();

const validatePostingDateQuery = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format.'),
});

fiscalYearsRouter.get('/validate-posting-date', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const { date } = validatePostingDateQuery.parse(req.query);
    const service = new PostingDateService(companyId);
    res.json(await service.validate(date));
  } catch (error) {
    next(error);
  }
});

fiscalYearsRouter.get('/', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const query = listFiscalYearsQuery.parse(req.query);
    const service = new FiscalYearService(companyId);
    res.json(await service.list(query.page, query.limit));
  } catch (error) {
    next(error);
  }
});

fiscalYearsRouter.post('/', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const body = createFiscalYearSchema.parse(req.body);
    const service = new FiscalYearService(companyId);
    res.status(201).json(await service.create(body));
  } catch (error) {
    next(error);
  }
});

fiscalYearsRouter.get('/:id/periods', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const { id } = fiscalYearIdParams.parse(req.params);
    const service = new FiscalYearService(companyId);
    res.json(await service.getPeriods(id));
  } catch (error) {
    next(error);
  }
});

fiscalYearsRouter.get('/:id/pre-close-check', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const { id } = fiscalYearIdParams.parse(req.params);
    const service = new FiscalYearService(companyId);
    res.json(await service.preCloseCheck(id));
  } catch (error) {
    next(error);
  }
});

fiscalYearsRouter.get('/:id/closing-issues', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const { id } = fiscalYearIdParams.parse(req.params);
    const query = closingIssuesQuery.parse(req.query);
    const service = new FiscalYearService(companyId);
    res.json(await service.closingIssues(id, query.check, query.page, query.limit));
  } catch (error) {
    next(error);
  }
});

fiscalYearsRouter.patch('/:id/close', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const { id } = fiscalYearIdParams.parse(req.params);
    const body = closeFiscalYearSchema.parse(req.body);
    const service = new FiscalYearService(companyId);
    res.json(await service.closeFiscalYear(id, body));
  } catch (error) {
    next(error);
  }
});

fiscalYearsRouter.patch('/:id/lock', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const { id } = fiscalYearIdParams.parse(req.params);
    const service = new FiscalYearService(companyId);
    res.json(await service.lockFiscalYear(id));
  } catch (error) {
    next(error);
  }
});

fiscalYearsRouter.patch('/periods/:id/lock', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const { id } = periodIdParams.parse(req.params);
    const service = new FiscalYearService(companyId);
    res.json(await service.lockPeriod(id));
  } catch (error) {
    next(error);
  }
});

fiscalYearsRouter.patch('/periods/:id/close', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const { id } = periodIdParams.parse(req.params);
    const service = new FiscalYearService(companyId);
    res.json(await service.closePeriod(id));
  } catch (error) {
    next(error);
  }
});
