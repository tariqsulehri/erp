import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from '../http/access-context.js';
import { resolveCompanyId } from '../http/company-context.js';
import { AccountListService } from '../modules/accounts/account-list.service.js';
import {
  accountListQuerySchema,
  accountChildrenQuerySchema,
  accountNextCodeQuerySchema,
  bulkSetAccountActiveSchema,
  bulkCreateAccountSchema,
  cloneAccountSchema,
  createAccountSchema,
  importAccountTemplateSchema,
  toggleAccountActiveSchema,
  updateAccountSchema,
  validateAccountCodeQuerySchema,
} from '../modules/accounts/account.schema.js';

export const accountsRouter = Router();

const accountListService = new AccountListService();

accountsRouter.get('/', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const query = accountListQuerySchema.parse(req.query);
    res.json(await accountListService.list(companyId, query));
  } catch (error) {
    next(error);
  }
});

accountsRouter.get('/opening-balance-summary', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    res.json(await accountListService.openingBalanceSummary(companyId));
  } catch (error) {
    next(error);
  }
});

accountsRouter.get('/hierarchy', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    res.json(await accountListService.hierarchy(companyId));
  } catch (error) {
    next(error);
  }
});

accountsRouter.get('/top-level', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    res.json(await accountListService.topLevel(companyId));
  } catch (error) {
    next(error);
  }
});

accountsRouter.get('/children', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const query = accountChildrenQuerySchema.parse(req.query);
    res.json(await accountListService.children(companyId, query.parent_code));
  } catch (error) {
    next(error);
  }
});

accountsRouter.get('/next-code', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const query = accountNextCodeQuerySchema.parse(req.query);
    res.json(await accountListService.nextCode(companyId, query.parent_code, query.is_posting));
  } catch (error) {
    next(error);
  }
});

accountsRouter.get('/validate-code', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const query = validateAccountCodeQuerySchema.parse(req.query);
    res.json(await accountListService.validateCode(companyId, query.code));
  } catch (error) {
    next(error);
  }
});

accountsRouter.get('/templates', async (_req, res, next) => {
  try {
    res.json(await accountListService.templates());
  } catch (error) {
    next(error);
  }
});

accountsRouter.get('/:id/history', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const id = z.string().uuid().parse(req.params.id);
    res.json(await accountListService.history(companyId, id));
  } catch (error) {
    next(error);
  }
});

accountsRouter.post('/', requirePermission('accounts.manage'), async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const input = createAccountSchema.parse(req.body);
    res.status(201).json(await accountListService.create(companyId, input));
  } catch (error) {
    next(error);
  }
});

accountsRouter.post('/bulk-create', requirePermission('accounts.manage'), async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const input = bulkCreateAccountSchema.parse(req.body);
    res.status(201).json(await accountListService.bulkCreate(
      companyId,
      input.rows.map(row => ({ ...row, is_system: false })),
    ));
  } catch (error) {
    next(error);
  }
});

accountsRouter.post('/templates/import', requirePermission('accounts.manage'), async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const input = importAccountTemplateSchema.parse(req.body);
    res.status(201).json(await accountListService.importTemplate(companyId, input.template_code));
  } catch (error) {
    next(error);
  }
});

accountsRouter.get('/:id', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const id = z.string().uuid().parse(req.params.id);
    res.json(await accountListService.getById(companyId, id));
  } catch (error) {
    next(error);
  }
});

accountsRouter.patch('/bulk-active', requirePermission('accounts.manage'), async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const input = bulkSetAccountActiveSchema.parse(req.body);
    res.json(await accountListService.bulkSetActive(companyId, input.ids, input.is_active));
  } catch (error) {
    next(error);
  }
});

accountsRouter.patch('/:id', requirePermission('accounts.manage'), async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const id = z.string().uuid().parse(req.params.id);
    const input = updateAccountSchema.parse(req.body);
    res.json({
      success: true,
      account: await accountListService.update(companyId, id, input),
      message: 'Account updated.',
    });
  } catch (error) {
    next(error);
  }
});

accountsRouter.patch('/:id/active', requirePermission('accounts.manage'), async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const id = z.string().uuid().parse(req.params.id);
    const input = toggleAccountActiveSchema.parse(req.body);
    res.json({
      success: true,
      account: await accountListService.setActive(companyId, id, input.is_active),
      message: `Account made ${input.is_active ? 'Active' : 'Inactive'}.`,
    });
  } catch (error) {
    next(error);
  }
});

accountsRouter.post('/:id/clone', requirePermission('accounts.manage'), async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const id = z.string().uuid().parse(req.params.id);
    const input = cloneAccountSchema.parse(req.body);
    res.status(201).json(await accountListService.clone(companyId, id, input.new_name));
  } catch (error) {
    next(error);
  }
});
