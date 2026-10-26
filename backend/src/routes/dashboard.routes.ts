import { Router } from 'express';
import { requirePermission } from '../http/access-context.js';
import { resolveCompanyId } from '../http/company-context.js';
import { DashboardKpiService } from '../modules/dashboard/dashboard-kpi.service.js';
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


/** Money figures (revenue, profit, receivables, payables, cash, stock) are financial information. */
dashboardRouter.get('/kpis', requirePermission('reports.financial'), async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    res.json(await new DashboardKpiService(companyId).kpis());
  } catch (error) {
    next(error);
  }
});
