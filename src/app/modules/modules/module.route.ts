import { UserRoleEnum } from '@prisma/client';
import express from 'express';

import { ModuleControllers } from './module.controller';
import { ModuleValidations } from './module.validation';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.INSTRUCTOR, UserRoleEnum.ADMIN),
  validateRequest(ModuleValidations.createModuleSchema),
  ModuleControllers.createModule,
);

router.get('/', ModuleControllers.getAllModules);

router.get('/:id', ModuleControllers.getSingleModule);

router.patch(
  '/:id',
  auth(UserRoleEnum.INSTRUCTOR, UserRoleEnum.ADMIN),
  validateRequest(ModuleValidations.updateModuleSchema),
  ModuleControllers.updateModule,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.INSTRUCTOR, UserRoleEnum.ADMIN),
  ModuleControllers.deleteModule,
);

export const ModuleRoutes = router;
