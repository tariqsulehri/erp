import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '@/server/trpc';
import { PurchaseService } from '@/modules/purchases/purchase.service';
import { CreatePurchaseInvoiceInput, ListPurchaseInvoicesQuery, PurchaseAnalyticsQuery } from '@/modules/purchases/purchase.schema';

const PURCHASE_BUSINESS_ERROR_PREFIXES = [
  'Invalid Purchase Date:',
  'Supplier was not found',
  'Supplier Linked Account',
  'Warehouse was not found',
  'Due Date',
  'Supplier Invoice Date',
  'Supplier Bill No.',
  'One or more purchase items',
  'Discount cannot',
  'Line Total',
  'Net Amount',
  'Only Draft purchase vouchers',
  'Purchase Voucher',
] as const;

function handlePurchaseError(error: unknown): never {
  if (error instanceof TRPCError) throw error;

  if (error instanceof Error) {
    const isBusinessError = PURCHASE_BUSINESS_ERROR_PREFIXES.some(prefix => error.message.startsWith(prefix));
    throw new TRPCError({
      code: isBusinessError ? 'BAD_REQUEST' : 'INTERNAL_SERVER_ERROR',
      message: isBusinessError ? error.message : 'Unable to process Purchase Voucher.',
      cause: error,
    });
  }

  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Unable to process Purchase Voucher.',
  });
}

export const purchasesRouter = router({
  supportData: protectedProcedure.query(async ({ ctx }) => {
    const service = new PurchaseService(ctx.company_id);
    return service.getSupportData();
  }),

  list: protectedProcedure
    .input(ListPurchaseInvoicesQuery)
    .query(async ({ ctx, input }) => {
      const service = new PurchaseService(ctx.company_id);
      return service.list(input);
    }),

  analytics: protectedProcedure
    .input(PurchaseAnalyticsQuery)
    .query(async ({ ctx, input }) => {
      const service = new PurchaseService(ctx.company_id);
      return service.analytics(input);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new PurchaseService(ctx.company_id);
      return service.getById(input.id);
    }),

  createDraft: protectedProcedure
    .input(CreatePurchaseInvoiceInput)
    .mutation(async ({ ctx, input }) => {
      try {
        const service = new PurchaseService(ctx.company_id);
        return await service.createDraft(input, ctx.user.id);
      } catch (error) {
        handlePurchaseError(error);
      }
    }),

  createAndPost: protectedProcedure
    .input(CreatePurchaseInvoiceInput)
    .mutation(async ({ ctx, input }) => {
      try {
        const service = new PurchaseService(ctx.company_id);
        return await service.createAndPost(input, ctx.user.id);
      } catch (error) {
        handlePurchaseError(error);
      }
    }),

  post: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const service = new PurchaseService(ctx.company_id);
        return await service.post(input.id, ctx.user.id);
      } catch (error) {
        handlePurchaseError(error);
      }
    }),
});
