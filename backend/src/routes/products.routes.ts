import { Router } from 'express';
import { resolveAccessScope, requirePermission } from '../http/access-context.js';
import { ProductService } from '../modules/inventory/product.service.js';
import {
  createBrandSchema,
  createCategorySchema,
  createColorSchema,
  createOriginSchema,
  createProductSchema,
  createProductTypeSchema,
  createSizeSchema,
  createUomSchema,
  idParams,
  listProductsQuery,
  suggestSkuQuery,
  updateBrandSchema,
  updateCategorySchema,
  updateColorSchema,
  updateOriginSchema,
  updateProductSchema,
  updateProductTypeSchema,
  updateSizeSchema,
  updateUomSchema,
} from '../modules/inventory/product.schema.js';

export const productsRouter = Router();

/* ── Suggested SKU ── */
productsRouter.get('/suggest-sku', async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const { prefix } = suggestSkuQuery.parse(req.query);
    const service = new ProductService(companyId, scope);
    res.json({ sku: await service.suggestSku(prefix) });
  } catch (error) {
    next(error);
  }
});

/* ── Categories ── */
productsRouter.get('/categories', async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const service = new ProductService(companyId, scope);
    res.json(await service.listCategories());
  } catch (error) {
    next(error);
  }
});

productsRouter.post('/categories', requirePermission('products.manage'), async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const body = createCategorySchema.parse(req.body);
    const service = new ProductService(companyId, scope);
    res.status(201).json(await service.createCategory(body));
  } catch (error) {
    next(error);
  }
});

productsRouter.patch('/categories/:id', requirePermission('products.manage'), async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const { id } = idParams.parse(req.params);
    const body = updateCategorySchema.parse({ ...req.body, id });
    const service = new ProductService(companyId, scope);
    res.json(await service.updateCategory(body));
  } catch (error) {
    next(error);
  }
});

productsRouter.delete('/categories/:id', requirePermission('products.manage'), async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const { id } = idParams.parse(req.params);
    const service = new ProductService(companyId, scope);
    await service.deleteCategory(id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

/* ── Brands ── */
productsRouter.get('/brands', async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const service = new ProductService(companyId, scope);
    res.json(await service.listBrands());
  } catch (error) {
    next(error);
  }
});

productsRouter.post('/brands', requirePermission('products.manage'), async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const body = createBrandSchema.parse(req.body);
    const service = new ProductService(companyId, scope);
    res.status(201).json(await service.createBrand(body));
  } catch (error) {
    next(error);
  }
});

productsRouter.patch('/brands/:id', requirePermission('products.manage'), async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const { id } = idParams.parse(req.params);
    const body = updateBrandSchema.parse({ ...req.body, id });
    const service = new ProductService(companyId, scope);
    res.json(await service.updateBrand(body));
  } catch (error) {
    next(error);
  }
});

productsRouter.delete('/brands/:id', requirePermission('products.manage'), async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const { id } = idParams.parse(req.params);
    const service = new ProductService(companyId, scope);
    await service.deleteBrand(id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

/* ── Product Types ── */
productsRouter.get('/product-types', async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const service = new ProductService(companyId, scope);
    res.json(await service.listProductTypes());
  } catch (error) {
    next(error);
  }
});

productsRouter.post('/product-types', requirePermission('products.manage'), async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const body = createProductTypeSchema.parse(req.body);
    const service = new ProductService(companyId, scope);
    res.status(201).json(await service.createProductType(body));
  } catch (error) {
    next(error);
  }
});

productsRouter.patch('/product-types/:id', requirePermission('products.manage'), async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const { id } = idParams.parse(req.params);
    const body = updateProductTypeSchema.parse({ ...req.body, id });
    const service = new ProductService(companyId, scope);
    res.json(await service.updateProductType(body));
  } catch (error) {
    next(error);
  }
});

productsRouter.delete('/product-types/:id', requirePermission('products.manage'), async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const { id } = idParams.parse(req.params);
    const service = new ProductService(companyId, scope);
    await service.deleteProductType(id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

/* ── Item Sizes ── */
productsRouter.get('/sizes', async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const service = new ProductService(companyId, scope);
    res.json(await service.listSizes());
  } catch (error) {
    next(error);
  }
});

productsRouter.post('/sizes', requirePermission('products.manage'), async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const body = createSizeSchema.parse(req.body);
    const service = new ProductService(companyId, scope);
    res.status(201).json(await service.createSize(body));
  } catch (error) {
    next(error);
  }
});

productsRouter.patch('/sizes/:id', requirePermission('products.manage'), async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const { id } = idParams.parse(req.params);
    const body = updateSizeSchema.parse({ ...req.body, id });
    const service = new ProductService(companyId, scope);
    res.json(await service.updateSize(body));
  } catch (error) {
    next(error);
  }
});

productsRouter.delete('/sizes/:id', requirePermission('products.manage'), async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const { id } = idParams.parse(req.params);
    const service = new ProductService(companyId, scope);
    await service.deleteSize(id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

/* ── Item Colors ── */
productsRouter.get('/colors', async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const service = new ProductService(companyId, scope);
    res.json(await service.listColors());
  } catch (error) {
    next(error);
  }
});

productsRouter.post('/colors', requirePermission('products.manage'), async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const body = createColorSchema.parse(req.body);
    const service = new ProductService(companyId, scope);
    res.status(201).json(await service.createColor(body));
  } catch (error) {
    next(error);
  }
});

productsRouter.patch('/colors/:id', requirePermission('products.manage'), async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const { id } = idParams.parse(req.params);
    const body = updateColorSchema.parse({ ...req.body, id });
    const service = new ProductService(companyId, scope);
    res.json(await service.updateColor(body));
  } catch (error) {
    next(error);
  }
});

productsRouter.delete('/colors/:id', requirePermission('products.manage'), async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const { id } = idParams.parse(req.params);
    const service = new ProductService(companyId, scope);
    await service.deleteColor(id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

/* ── Origins ── */
productsRouter.get('/origins', async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const service = new ProductService(companyId, scope);
    res.json(await service.listOrigins());
  } catch (error) {
    next(error);
  }
});

productsRouter.post('/origins', requirePermission('products.manage'), async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const body = createOriginSchema.parse(req.body);
    const service = new ProductService(companyId, scope);
    res.status(201).json(await service.createOrigin(body));
  } catch (error) {
    next(error);
  }
});

productsRouter.patch('/origins/:id', requirePermission('products.manage'), async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const { id } = idParams.parse(req.params);
    const body = updateOriginSchema.parse({ ...req.body, id });
    const service = new ProductService(companyId, scope);
    res.json(await service.updateOrigin(body));
  } catch (error) {
    next(error);
  }
});

productsRouter.delete('/origins/:id', requirePermission('products.manage'), async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const { id } = idParams.parse(req.params);
    const service = new ProductService(companyId, scope);
    await service.deleteOrigin(id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

/* ── Units of Measure ── */
productsRouter.get('/units-of-measure', async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const service = new ProductService(companyId, scope);
    res.json(await service.listUom());
  } catch (error) {
    next(error);
  }
});

productsRouter.post('/units-of-measure', requirePermission('products.manage'), async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const body = createUomSchema.parse(req.body);
    const service = new ProductService(companyId, scope);
    res.status(201).json(await service.createUom(body));
  } catch (error) {
    next(error);
  }
});

productsRouter.patch('/units-of-measure/:id', requirePermission('products.manage'), async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const { id } = idParams.parse(req.params);
    const body = updateUomSchema.parse({ ...req.body, id });
    const service = new ProductService(companyId, scope);
    res.json(await service.updateUom(body));
  } catch (error) {
    next(error);
  }
});

productsRouter.delete('/units-of-measure/:id', requirePermission('products.manage'), async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const { id } = idParams.parse(req.params);
    const service = new ProductService(companyId, scope);
    await service.deleteUom(id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

/* ── Products List & Create ── */
productsRouter.get('/', async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const query = listProductsQuery.parse(req.query);
    const service = new ProductService(companyId, scope);
    res.json(await service.list(query));
  } catch (error) {
    next(error);
  }
});

productsRouter.post('/', requirePermission('products.manage'), async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const body = createProductSchema.parse(req.body);
    const service = new ProductService(companyId, scope);
    res.status(201).json(await service.create(body));
  } catch (error) {
    next(error);
  }
});

/* ── Product Detail, Update, Archive, Delete ── */
productsRouter.get('/:id', async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const { id } = idParams.parse(req.params);
    const service = new ProductService(companyId, scope);
    const product = await service.getById(id);
    if (!product) {
      const error = new Error('Product not found.');
      Object.assign(error, { statusCode: 404 });
      throw error;
    }
    res.json(product);
  } catch (error) {
    next(error);
  }
});

productsRouter.patch('/:id', requirePermission('products.manage'), async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const { id } = idParams.parse(req.params);
    const body = updateProductSchema.parse({ ...req.body, id });
    const service = new ProductService(companyId, scope);
    res.json(await service.update(body));
  } catch (error) {
    next(error);
  }
});

productsRouter.patch('/:id/archive', requirePermission('products.manage'), async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const { id } = idParams.parse(req.params);
    const service = new ProductService(companyId, scope);
    await service.archive(id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

productsRouter.delete('/:id', requirePermission('products.manage'), async (req, res, next) => {
  try {
    const scope = resolveAccessScope(req);
    const companyId = scope.companyId;
    const { id } = idParams.parse(req.params);
    const service = new ProductService(companyId, scope);
    await service.delete(id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
