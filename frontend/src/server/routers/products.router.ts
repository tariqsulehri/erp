import { z } from 'zod';
import { router, protectedProcedure } from '@/server/trpc';
import { ProductService } from '@/modules/inventory/product.service';
import {
  CreateProductInput, UpdateProductInput, ListProductsQuery,
  CreateCategoryInput, UpdateCategoryInput,
  CreateUomInput,     UpdateUomInput,
} from '@/modules/inventory/product.schema';

export const productsRouter = router({

  /* ── SKU suggestion ──────────────────────────────────────────── */
  suggestSku: protectedProcedure
    .input(z.object({ prefix: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const svc = new ProductService(ctx.company_id);
      return { sku: await svc.suggestSku(input.prefix) };
    }),

  /* ── Product CRUD ────────────────────────────────────────────── */
  list: protectedProcedure
    .input(ListProductsQuery)
    .query(async ({ ctx, input }) => {
      const svc = new ProductService(ctx.company_id);
      return svc.list(input);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const svc = new ProductService(ctx.company_id);
      const p = await svc.getById(input.id);
      if (!p) throw new Error('Product not found');
      return p;
    }),

  create: protectedProcedure
    .input(CreateProductInput)
    .mutation(async ({ ctx, input }) => {
      const svc = new ProductService(ctx.company_id);
      return svc.create(input, ctx.user.id);
    }),

  update: protectedProcedure
    .input(UpdateProductInput)
    .mutation(async ({ ctx, input }) => {
      const svc = new ProductService(ctx.company_id);
      return svc.update(input, ctx.user.id);
    }),

  archive: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const svc = new ProductService(ctx.company_id);
      await svc.archive(input.id);
      return { ok: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const svc = new ProductService(ctx.company_id);
      await svc.delete(input.id);
      return { ok: true };
    }),

  /* ── Category CRUD ───────────────────────────────────────────── */
  listCategories: protectedProcedure
    .query(async ({ ctx }) => {
      const svc = new ProductService(ctx.company_id);
      return svc.listCategories();
    }),

  listBrands: protectedProcedure
    .query(async ({ ctx }) => {
      const svc = new ProductService(ctx.company_id);
      return svc.listBrands();
    }),

  createCategory: protectedProcedure
    .input(CreateCategoryInput)
    .mutation(async ({ ctx, input }) => {
      const svc = new ProductService(ctx.company_id);
      return svc.createCategory(input);
    }),

  updateCategory: protectedProcedure
    .input(UpdateCategoryInput)
    .mutation(async ({ ctx, input }) => {
      const svc = new ProductService(ctx.company_id);
      return svc.updateCategory(input);
    }),

  deleteCategory: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const svc = new ProductService(ctx.company_id);
      await svc.deleteCategory(input.id);
      return { ok: true };
    }),

  /* ── UOM CRUD ────────────────────────────────────────────────── */
  listUom: protectedProcedure
    .query(async ({ ctx }) => {
      const svc = new ProductService(ctx.company_id);
      return svc.listUom();
    }),

  createUom: protectedProcedure
    .input(CreateUomInput)
    .mutation(async ({ ctx, input }) => {
      const svc = new ProductService(ctx.company_id);
      return svc.createUom(input);
    }),

  updateUom: protectedProcedure
    .input(UpdateUomInput)
    .mutation(async ({ ctx, input }) => {
      const svc = new ProductService(ctx.company_id);
      return svc.updateUom(input);
    }),

  deleteUom: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const svc = new ProductService(ctx.company_id);
      await svc.deleteUom(input.id);
      return { ok: true };
    }),
});
