import { z } from 'zod';
import { router, protectedProcedure } from '@/server/trpc';
import { AppDataSource } from '@/db/data-source';
import { Company } from '@/modules/companies/company.entity';

const UpdateCompanyInput = z.object({
  name:               z.string().min(1).max(100).optional(),
  registration_number: z.string().max(50).optional().nullable(),
  tax_id:             z.string().max(50).optional().nullable(),
  currency_code:      z.string().length(3).optional().nullable(),
  address:            z.string().max(200).optional().nullable(),
  city:               z.string().max(100).optional().nullable(),
  country:            z.string().max(100).optional().nullable(),
  phone:              z.string().max(30).optional().nullable(),
  email:              z.string().email().optional().nullable(),
  fiscal_year_basis:  z.enum(['calendar', 'july', 'april']).optional(),
  number_of_periods:  z.number().int().min(1).max(12).optional(),
  description:        z.string().max(500).optional().nullable(),
});

export const settingsRouter = router({
  /** Fetch the current company record */
  getCompany: protectedProcedure
    .query(async ({ ctx }) => {
      const repo = AppDataSource.getRepository(Company);
      const company = await repo.findOne({ where: { id: ctx.company_id } });
      if (!company) throw new Error('Company not found');
      return company;
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
});
