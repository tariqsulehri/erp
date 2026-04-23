import { z }                  from 'zod';
import { router, protectedProcedure } from '@/server/trpc';
import { CustomerService }    from '@/modules/customers/customer.service';
import {
  CreateCustomerInput,
  UpdateCustomerInput,
  ListCustomersQuery,
} from '@/modules/customers/customer.schema';
import { AppDataSource } from '@/db/data-source';

export const customersRouter = router({

  /* ── List ─────────────────────────────────────────────────── */
  list: protectedProcedure
    .input(ListCustomersQuery)
    .query(async ({ ctx, input }) => {
      const svc = new CustomerService(ctx.company_id);
      return svc.list(input);
    }),

  /* ── Stats ────────────────────────────────────────────────── */
  stats: protectedProcedure
    .query(async ({ ctx }) => {
      const svc = new CustomerService(ctx.company_id);
      return svc.stats();
    }),

  /* ── Suggest next code ────────────────────────────────────── */
  nextCode: protectedProcedure
    .query(async ({ ctx }) => {
      const svc = new CustomerService(ctx.company_id);
      return svc.nextCode();
    }),

  /* ── Get single ───────────────────────────────────────────── */
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const svc = new CustomerService(ctx.company_id);
      return svc.get(input.id);
    }),

  /* ── Create ───────────────────────────────────────────────── */
  create: protectedProcedure
    .input(CreateCustomerInput)
    .mutation(async ({ ctx, input }) => {
      const svc = new CustomerService(ctx.company_id);
      return svc.create(input);
    }),

  /* ── Update ───────────────────────────────────────────────── */
  update: protectedProcedure
    .input(UpdateCustomerInput)
    .mutation(async ({ ctx, input }) => {
      const svc = new CustomerService(ctx.company_id);
      return svc.update(input);
    }),

  /* ── Delete ───────────────────────────────────────────────── */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const svc = new CustomerService(ctx.company_id);
      await svc.delete(input.id);
      return { success: true };
    }),

  /* ── Accounts for COA selector ────────────────────────────── */
  listAccounts: protectedProcedure
    .query(async ({ ctx }) => {
      const result = await AppDataSource.query<{ id: string; code: string; name: string; account_type: string }[]>(`
        SELECT id, code, name, account_type
          FROM accounts
         WHERE company_id = $1
           AND is_active  = true
           AND is_posting = true
         ORDER BY code ASC
         LIMIT 500
      `, [ctx.company_id]);
      return result;
    }),
});
