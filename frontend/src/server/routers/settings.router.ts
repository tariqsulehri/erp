import { z } from 'zod';
import { router, protectedProcedure } from '@/server/trpc';
import { AppDataSource } from '@/db/data-source';
import { Company } from '@/modules/companies/company.entity';
import { GeneralSettingsService } from '@/modules/settings/general-settings.service';

const UpdateCompanyInput = z.object({
  name:               z.string().min(1).max(100).optional(),
  registration_number: z.string().max(50).optional().nullable(),
  tax_id:             z.string().max(50).optional().nullable(),
  address:            z.string().max(200).optional().nullable(),
  city:               z.string().max(100).optional().nullable(),
  country:            z.string().max(100).optional().nullable(),
  phone:              z.string().max(30).optional().nullable(),
  email:              z.string().email().optional().nullable(),
  fiscal_year_basis:  z.enum(['calendar', 'july', 'april']).optional(),
  number_of_periods:  z.number().int().min(1).max(12).optional(),
  description:        z.string().max(500).optional().nullable(),
});

const GeneralSettingsInput = z.object({
  currency_code:        z.string().length(3).optional().nullable(),
  currency_symbol:      z.string().min(1).max(10).optional().nullable(),
  currency_position:    z.enum(['prefix', 'suffix']).optional().nullable(),
  decimal_places:       z.number().int().min(0).max(6).optional(),
  thousand_separator:   z.enum([',', '.', "'", ' ']).optional().nullable(),
  decimal_separator:    z.enum(['.', ',']).optional().nullable(),
  date_format:          z.enum(['dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd', 'dd-MMM-yyyy']).optional().nullable(),
  time_format:          z.enum(['12-hour', '24-hour']).optional().nullable(),
  time_zone:            z.string().min(1).max(80).optional().nullable(),
  locale:               z.string().min(2).max(20).optional().nullable(),
  default_country_code: z.string().length(2).optional().nullable(),
  is_active:            z.boolean().optional(),
}).refine(
  (input) => !input.thousand_separator || !input.decimal_separator || input.thousand_separator !== input.decimal_separator,
  { message: 'Thousand Separator and Decimal Separator cannot be the same.' },
);

export const settingsRouter = router({
  /** Fetch the current company record */
  getCompany: protectedProcedure
    .query(async ({ ctx }) => {
      const repo = AppDataSource.getRepository(Company);
      const company = await repo.findOne({ where: { id: ctx.company_id } });
      if (!company) throw new Error('Company not found');
      return company;
    }),

  /** Fetch company-level general settings used by modules for formatting. */
  getGeneralSettings: protectedProcedure
    .query(async ({ ctx }) => {
      const service = new GeneralSettingsService(ctx.company_id);
      return service.get();
    }),

  /** Update editable company fields. Admin only. */
  updateCompany: protectedProcedure
    .input(UpdateCompanyInput)
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== 'admin') {
        throw new Error('Only admins can update company settings');
      }
      const repo = AppDataSource.getRepository(Company);
      await repo.update({ id: ctx.company_id }, input as Partial<Company>);
      const updated = await repo.findOne({ where: { id: ctx.company_id } });
      if (!updated) throw new Error('Company not found after update');
      return updated;
    }),

  /** Update company-level general settings. Admin only. */
  updateGeneralSettings: protectedProcedure
    .input(GeneralSettingsInput)
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== 'admin') {
        throw new Error('Only admins can update general settings');
      }
      const service = new GeneralSettingsService(ctx.company_id);
      return service.update(input);
    }),
});
