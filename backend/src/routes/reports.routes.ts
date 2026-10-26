import { Router } from 'express';
import { requirePermission, resolveAccessScope } from '../http/access-context.js';
import { resolveCompanyId } from '../http/company-context.js';
import { AgingReportService } from '../modules/reports/aging-report.service.js';
import { BookAccountsService } from '../modules/reports/book-accounts.service.js';
import {
  agingQuerySchema,
  bookAccountsQuerySchema,
  dayBookQuerySchema,
  salesTaxQuerySchema,
  stockLedgerQuerySchema,
  stockValuationQuerySchema,
} from '../modules/reports/business-report.schema.js';
import { DayBookReportService } from '../modules/reports/day-book-report.service.js';
import { SalesTaxReportService } from '../modules/reports/sales-tax-report.service.js';
import { StockReportService } from '../modules/reports/stock-report.service.js';
import { balanceSheetReportQuerySchema } from '../modules/reports/balance-sheet-report.schema.js';
import { BalanceSheetReportService } from '../modules/reports/balance-sheet-report.service.js';
import { ledgerReportQuerySchema } from '../modules/reports/ledger-report.schema.js';
import { LedgerReportService } from '../modules/reports/ledger-report.service.js';
import { profitAndLossReportQuerySchema } from '../modules/reports/profit-and-loss-report.schema.js';
import { ProfitAndLossReportService } from '../modules/reports/profit-and-loss-report.service.js';
import { trialBalanceReportQuerySchema } from '../modules/reports/trial-balance-report.schema.js';
import { TrialBalanceReportService } from '../modules/reports/trial-balance-report.service.js';

export const reportsRouter = Router();

reportsRouter.get('/ledger', requirePermission('reports.financial'), async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const query = ledgerReportQuerySchema.parse(req.query);
    const service = new LedgerReportService(companyId);
    res.json(await service.getAccountLedger(query));
  } catch (error) {
    next(error);
  }
});

reportsRouter.get('/trial-balance', requirePermission('reports.financial'), async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const query = trialBalanceReportQuerySchema.parse(req.query);
    const service = new TrialBalanceReportService(companyId);
    res.json(await service.getTrialBalance(query));
  } catch (error) {
    next(error);
  }
});

reportsRouter.get('/profit-and-loss', requirePermission('reports.financial'), async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const query = profitAndLossReportQuerySchema.parse(req.query);
    const service = new ProfitAndLossReportService(companyId);
    res.json(await service.getProfitAndLoss(query));
  } catch (error) {
    next(error);
  }
});

reportsRouter.get('/balance-sheet', requirePermission('reports.financial'), async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const query = balanceSheetReportQuerySchema.parse(req.query);
    const service = new BalanceSheetReportService(companyId);
    res.json(await service.getBalanceSheet(query));
  } catch (error) {
    next(error);
  }
});

reportsRouter.get('/day-book', requirePermission('reports.financial'), async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    res.json(await new DayBookReportService(companyId).getDayBook(dayBookQuerySchema.parse(req.query)));
  } catch (error) {
    next(error);
  }
});

reportsRouter.get('/aging', requirePermission('reports.financial'), async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    res.json(await new AgingReportService(companyId).getAging(agingQuerySchema.parse(req.query)));
  } catch (error) {
    next(error);
  }
});

reportsRouter.get('/sales-tax', requirePermission('reports.financial'), async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    res.json(await new SalesTaxReportService(companyId).getSalesTax(salesTaxQuerySchema.parse(req.query)));
  } catch (error) {
    next(error);
  }
});

/** Accounts for the Cash Book, Bank Book, Customer Ledger and Supplier Ledger pickers. */
reportsRouter.get('/book-accounts', requirePermission('reports.financial'), async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    res.json(await new BookAccountsService(companyId).list(bookAccountsQuerySchema.parse(req.query)));
  } catch (error) {
    next(error);
  }
});

reportsRouter.get('/stock-ledger', async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    res.json(await new StockReportService(scope.companyId, scope).getStockLedger(stockLedgerQuerySchema.parse(req.query)));
  } catch (error) {
    next(error);
  }
});

reportsRouter.get('/stock-valuation', async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    res.json(await new StockReportService(scope.companyId, scope).getStockValuation(stockValuationQuerySchema.parse(req.query)));
  } catch (error) {
    next(error);
  }
});
