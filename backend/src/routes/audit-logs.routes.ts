import { Router } from 'express';
import { requireUserManager } from '../http/access-context.js';
import { resolveCompanyId } from '../http/company-context.js';
import { listAuditLogsQuery } from '../modules/audit/audit.schema.js';
import { AuditService } from '../modules/audit/audit.service.js';

export const auditLogsRouter = Router();

auditLogsRouter.get('/stats', async (req, res, next) => {
  try {
    const actor = requireUserManager(req);
    const companyId = resolveCompanyId(req);
    const service = new AuditService(companyId, actor);
    const filterQuery = {
      from_date: typeof req.query.from_date === 'string' ? req.query.from_date : undefined,
      to_date: typeof req.query.to_date === 'string' ? req.query.to_date : undefined,
    };
    res.json(await service.getStats(filterQuery));
  } catch (error) {
    next(error);
  }
});

auditLogsRouter.get('/', async (req, res, next) => {
  try {
    const actor = requireUserManager(req);
    const companyId = resolveCompanyId(req);
    const service = new AuditService(companyId, actor);
    const query = listAuditLogsQuery.parse(req.query);
    res.json(await service.list(query));
  } catch (error) {
    next(error);
  }
});
