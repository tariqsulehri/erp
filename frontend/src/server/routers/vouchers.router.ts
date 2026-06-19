import { z } from 'zod';
import { router, protectedProcedure } from '@/server/trpc';
import { VoucherService } from '@/modules/vouchers/voucher.service';
import { CreateVoucherInput, ListVouchersQuery } from '@/modules/vouchers/voucher.schema';

export const vouchersRouter = router({
  list: protectedProcedure
    .input(ListVouchersQuery)
    .query(async ({ ctx, input }) => {
      const svc = new VoucherService(ctx.company_id);
      return svc.list(input);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const svc = new VoucherService(ctx.company_id);
      const v   = await svc.getById(input.id);
      if (!v) throw new Error('Voucher not found');
      return v;
    }),

  create: protectedProcedure
    .input(CreateVoucherInput)
    .mutation(async ({ ctx, input }) => {
      const svc = new VoucherService(ctx.company_id);
      return svc.createVoucher(input, ctx.user.id);
    }),

  post: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const svc = new VoucherService(ctx.company_id);
      return svc.postVoucher(input.id, ctx.user.id);
    }),

  void: protectedProcedure
    .input(z.object({ id: z.string().uuid(), reason: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const svc = new VoucherService(ctx.company_id);
      return svc.voidVoucher(input.id, ctx.user.id, input.reason);
    }),
});
