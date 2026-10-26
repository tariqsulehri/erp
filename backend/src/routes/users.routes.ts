import { Router } from 'express';
import { requireUserManager } from '../http/access-context.js';
import { resolveCompanyId } from '../http/company-context.js';
import { createUserSchema, idParams, listUsersQuery, resetPasswordSchema, updateUserSchema } from '../modules/users/user.schema.js';
import { UserService } from '../modules/users/user.service.js';

export const usersRouter = Router();

function serviceFor(req: Parameters<typeof requireUserManager>[0]) {
  const actor = requireUserManager(req);
  return new UserService(resolveCompanyId(req), actor);
}

usersRouter.get('/', async (req, res, next) => {
  try {
    const service = serviceFor(req);
    res.json(await service.list(listUsersQuery.parse(req.query)));
  } catch (error) {
    next(error);
  }
});

usersRouter.post('/', async (req, res, next) => {
  try {
    const service = serviceFor(req);
    res.status(201).json(await service.create(createUserSchema.parse(req.body)));
  } catch (error) {
    next(error);
  }
});

usersRouter.get('/:id', async (req, res, next) => {
  try {
    const service = serviceFor(req);
    const { id } = idParams.parse(req.params);
    res.json(await service.getById(id));
  } catch (error) {
    next(error);
  }
});

usersRouter.patch('/:id', async (req, res, next) => {
  try {
    const service = serviceFor(req);
    const { id } = idParams.parse(req.params);
    res.json(await service.update(updateUserSchema.parse({ ...req.body, id })));
  } catch (error) {
    next(error);
  }
});

usersRouter.post('/:id/reset-password', async (req, res, next) => {
  try {
    const service = serviceFor(req);
    const { id } = idParams.parse(req.params);
    res.json(await service.resetPassword(id, resetPasswordSchema.parse(req.body)));
  } catch (error) {
    next(error);
  }
});
