import { Router } from 'express';
import { resolveCompanyId } from '../http/company-context.js';
import { DashboardService } from '../modules/dashboard/dashboard.service.js';

export const dashboardRouter = Router();

dashboardRouter.get('/summary', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const service = new DashboardService(companyId);
    res.json(await service.summary());
  } catch (error) {
    next(error);
  }
});

