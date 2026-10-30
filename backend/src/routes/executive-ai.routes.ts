import { Router } from 'express';
import { requireUserManager } from '../http/access-context.js';
import { resolveCompanyId } from '../http/company-context.js';
import { executiveQuerySchema } from '../modules/executive-ai/executive-ai.schema.js';
import { ExecutiveAiService } from '../modules/executive-ai/executive-ai.service.js';

export const executiveAiRouter = Router();

/**
 * Instant Executive Pulse Briefing for CEO and Top Management
 * Aggregates live database metrics across Treasury, Profitability, Receivables, Payables, Stock, and Governance.
 */
executiveAiRouter.get('/briefing', async (req, res, next) => {
  try {
    const actor = requireUserManager(req);
    const companyId = resolveCompanyId(req);
    const service = new ExecutiveAiService(companyId, actor);
    res.json(await service.getExecutiveBriefing());
  } catch (error) {
    next(error);
  }
});

/**
 * Dynamic Q&A Query for CEO and Top Management
 * Analyzes questions and queries live PostgreSQL ledger records.
 */
executiveAiRouter.post('/query', async (req, res, next) => {
  try {
    const actor = requireUserManager(req);
    const companyId = resolveCompanyId(req);
    const { question } = executiveQuerySchema.parse(req.body);
    const service = new ExecutiveAiService(companyId, actor);
    res.json(await service.answerQuery(question));
  } catch (error) {
    next(error);
  }
});

/**
 * Live Strategic Recommendations for Leadership
 */
executiveAiRouter.get('/suggestions', async (req, res, next) => {
  try {
    const actor = requireUserManager(req);
    const companyId = resolveCompanyId(req);
    const service = new ExecutiveAiService(companyId, actor);
    const briefing = await service.getExecutiveBriefing();
    res.json(briefing.strategicSuggestions);
  } catch (error) {
    next(error);
  }
});
