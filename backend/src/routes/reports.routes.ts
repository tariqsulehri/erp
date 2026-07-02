import { Router } from 'express';
import { resolveCompanyId } from '../http/company-context.js';
import { balanceSheetReportQuerySchema } from '../modules/reports/balance-sheet-report.schema.js';
import { BalanceSheetReportService } from '../modules/reports/balance-sheet-report.service.js';
import { ledgerReportQuerySchema } from '../modules/reports/ledger-report.schema.js';
import { LedgerReportService } from '../modules/reports/ledger-report.service.js';
import { profitAndLossReportQuerySchema } from '../modules/reports/profit-and-loss-report.schema.js';
import { ProfitAndLossReportService } from '../modules/reports/profit-and-loss-report.service.js';
import { trialBalanceReportQuerySchema } from '../modules/reports/trial-balance-report.schema.js';
import { TrialBalanceReportService } from '../modules/reports/trial-balance-report.service.js';

export const reportsRouter = Router();

reportsRouter.get('/ledger', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const query = ledgerReportQuerySchema.parse(req.query);
    const service = new LedgerReportService(companyId);
    res.json(await service.getAccountLedger(query));
  } catch (error) {
    next(error);
  }
});

reportsRouter.get('/trial-balance', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const query = trialBalanceReportQuerySchema.parse(req.query);
    const service = new TrialBalanceReportService(companyId);
    res.json(await service.getTrialBalance(query));
  } catch (error) {
    next(error);
  }
});

reportsRouter.get('/profit-and-loss', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const query = profitAndLossReportQuerySchema.parse(req.query);
    const service = new ProfitAndLossReportService(companyId);
    res.json(await service.getProfitAndLoss(query));
  } catch (error) {
    next(error);
  }
});

reportsRouter.get('/balance-sheet', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const query = balanceSheetReportQuerySchema.parse(req.query);
    const service = new BalanceSheetReportService(companyId);
    res.json(await service.getBalanceSheet(query));
  } catch (error) {
    next(error);
  }
});
