import { UserRoleEnum } from '@prisma/client';
import express from 'express';

import { CategoryControllers } from './category.controller';
import { CategoryValidations } from './category.validation';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.ADMIN),
  validateRequest(CategoryValidations.createCategorySchema),
  CategoryControllers.createCategory,
);

router.get('/', CategoryControllers.getAllCategories);

router.get('/:idOrSlug', CategoryControllers.getSingleCategory);

router.patch(
  '/:id',
  auth(UserRoleEnum.ADMIN),
  validateRequest(CategoryValidations.updateCategorySchema),
  CategoryControllers.updateCategory,
);

router.delete('/:id', auth(UserRoleEnum.ADMIN), CategoryControllers.deleteCategory);

export const CategoryRoutes = router;
