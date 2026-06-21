import { Router } from 'express';
import { z } from 'zod';
import { resolveCompanyId } from '../http/company-context.js';
import { CompanyProfileService } from '../modules/settings/company-profile.service.js';
import { GeneralSettingsService } from '../modules/settings/general-settings.service.js';

export const settingsRouter = Router();

const companyProfileService = new CompanyProfileService();
const generalSettingsService = new GeneralSettingsService();

const updateCompanyProfileSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  registration_number: z.string().trim().max(20).nullable().optional(),
  tax_id: z.string().trim().max(50).nullable().optional(),
  address: z.string().trim().max(200).nullable().optional(),
  city: z.string().trim().max(100).nullable().optional(),
  country: z.string().trim().max(100).nullable().optional(),
  phone: z.string().trim().max(20).nullable().optional(),
  email: z.string().trim().email().nullable().optional(),
  fiscal_year_basis: z.enum(['calendar', 'july', 'april']).optional(),
  number_of_periods: z.number().int().min(1).max(12).optional(),
});

const updateGeneralSettingsSchema = z.object({
  currency_code: z.string().trim().length(3).nullable().optional(),
  currency_symbol: z.string().trim().min(1).max(10).nullable().optional(),
  currency_position: z.enum(['prefix', 'suffix']).nullable().optional(),
  decimal_places: z.number().int().min(0).max(6).optional(),
  thousand_separator: z.enum([',', '.', "'", ' ']).nullable().optional(),
  decimal_separator: z.enum(['.', ',']).nullable().optional(),
  date_format: z.enum(['dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd', 'dd-MMM-yyyy']).nullable().optional(),
  time_format: z.enum(['12-hour', '24-hour']).nullable().optional(),
  time_zone: z.string().trim().min(1).max(80).nullable().optional(),
  locale: z.string().trim().min(2).max(20).nullable().optional(),
  default_country_code: z.string().trim().length(2).nullable().optional(),
  is_active: z.boolean().optional(),
}).refine(
  value => value.thousand_separator == null || value.decimal_separator == null || value.thousand_separator !== value.decimal_separator,
  { message: 'Thousand Separator and Decimal Separator cannot be the same.' },
);

settingsRouter.get('/company', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const company = await companyProfileService.getForCompany(companyId);
    res.json(company);
  } catch (error) {
    next(error);
  }
});

settingsRouter.patch('/company', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const input = updateCompanyProfileSchema.parse(req.body);
    const company = await companyProfileService.updateForCompany(companyId, input);
    res.json(company);
  } catch (error) {
    next(error);
  }
});

settingsRouter.get('/general', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const settings = await generalSettingsService.getForCompany(companyId);
    res.json(settings);
  } catch (error) {
    next(error);
  }
});

settingsRouter.patch('/general', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const input = updateGeneralSettingsSchema.parse(req.body);
    const settings = await generalSettingsService.updateForCompany(companyId, input);
    res.json(settings);
  } catch (error) {
    next(error);
  }
});
