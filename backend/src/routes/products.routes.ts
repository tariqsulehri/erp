import { Router } from 'express';
import { resolveCompanyId } from '../http/company-context.js';
import { ProductService } from '../modules/inventory/product.service.js';
import {
  createCategorySchema,
  createProductSchema,
  createUomSchema,
  idParams,
  listProductsQuery,
  suggestSkuQuery,
  updateCategorySchema,
  updateProductSchema,
  updateUomSchema,
} from '../modules/inventory/product.schema.js';

export const productsRouter = Router();

productsRouter.get('/suggest-sku', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const { prefix } = suggestSkuQuery.parse(req.query);
    const service = new ProductService(companyId);
    res.json({ sku: await service.suggestSku(prefix) });
  } catch (error) {
    next(error);
  }
});

productsRouter.get('/', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const query = listProductsQuery.parse(req.query);
    const service = new ProductService(companyId);
    res.json(await service.list(query));
  } catch (error) {
    next(error);
  }
});

productsRouter.post('/', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const body = createProductSchema.parse(req.body);
    const service = new ProductService(companyId);
    res.status(201).json(await service.create(body));
  } catch (error) {
    next(error);
  }
});

productsRouter.get('/categories', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const service = new ProductService(companyId);
    res.json(await service.listCategories());
  } catch (error) {
    next(error);
  }
});

productsRouter.post('/categories', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const body = createCategorySchema.parse(req.body);
    const service = new ProductService(companyId);
    res.status(201).json(await service.createCategory(body));
  } catch (error) {
    next(error);
  }
});

productsRouter.patch('/categories/:id', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const { id } = idParams.parse(req.params);
    const body = updateCategorySchema.parse({ ...req.body, id });
    const service = new ProductService(companyId);
    res.json(await service.updateCategory(body));
  } catch (error) {
    next(error);
  }
});

productsRouter.delete('/categories/:id', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const { id } = idParams.parse(req.params);
    const service = new ProductService(companyId);
    await service.deleteCategory(id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

productsRouter.get('/brands', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const service = new ProductService(companyId);
    res.json(await service.listBrands());
  } catch (error) {
    next(error);
  }
});

productsRouter.get('/units-of-measure', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const service = new ProductService(companyId);
    res.json(await service.listUom());
  } catch (error) {
    next(error);
  }
});

productsRouter.post('/units-of-measure', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const body = createUomSchema.parse(req.body);
    const service = new ProductService(companyId);
    res.status(201).json(await service.createUom(body));
  } catch (error) {
    next(error);
  }
});

productsRouter.patch('/units-of-measure/:id', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const { id } = idParams.parse(req.params);
    const body = updateUomSchema.parse({ ...req.body, id });
    const service = new ProductService(companyId);
    res.json(await service.updateUom(body));
  } catch (error) {
    next(error);
  }
});

productsRouter.delete('/units-of-measure/:id', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const { id } = idParams.parse(req.params);
    const service = new ProductService(companyId);
    await service.deleteUom(id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

productsRouter.get('/:id', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const { id } = idParams.parse(req.params);
    const service = new ProductService(companyId);
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

productsRouter.patch('/:id', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const { id } = idParams.parse(req.params);
    const body = updateProductSchema.parse({ ...req.body, id });
    const service = new ProductService(companyId);
    res.json(await service.update(body));
  } catch (error) {
    next(error);
  }
});

productsRouter.patch('/:id/archive', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const { id } = idParams.parse(req.params);
    const service = new ProductService(companyId);
    await service.archive(id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

productsRouter.delete('/:id', async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const { id } = idParams.parse(req.params);
    const service = new ProductService(companyId);
    await service.delete(id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

