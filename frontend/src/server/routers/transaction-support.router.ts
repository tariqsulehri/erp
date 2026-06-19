import { z } from 'zod';
import { router, protectedProcedure } from '@/server/trpc';
import { TransactionSupportService } from '@/modules/transactions/transaction-support.service';

const ListMasterQuery = z.object({
  search: z.string().optional(),
});

export const transactionSupportRouter = router({
  costCenters: protectedProcedure
    .input(ListMasterQuery)
    .query(async ({ ctx, input }) => {
      const service = new TransactionSupportService(ctx.company_id);
      return service.list('costCenter', input.search);
    }),

  projects: protectedProcedure
    .input(ListMasterQuery)
    .query(async ({ ctx, input }) => {
      const service = new TransactionSupportService(ctx.company_id);
      return service.list('project', input.search);
    }),

  departments: protectedProcedure
    .input(ListMasterQuery)
    .query(async ({ ctx, input }) => {
      const service = new TransactionSupportService(ctx.company_id);
      return service.list('department', input.search);
    }),
});
