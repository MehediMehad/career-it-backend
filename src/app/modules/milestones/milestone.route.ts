import { UserRoleEnum } from '@prisma/client';
import express from 'express';

import { MilestoneControllers } from './milestone.controller';
import { MilestoneValidations } from './milestone.validation';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.INSTRUCTOR, UserRoleEnum.ADMIN),
  validateRequest(MilestoneValidations.createMilestoneSchema),
  MilestoneControllers.createMilestone,
);

router.get('/', MilestoneControllers.getAllMilestones);

router.get('/:id', MilestoneControllers.getSingleMilestone);

router.patch(
  '/:id',
  auth(UserRoleEnum.INSTRUCTOR, UserRoleEnum.ADMIN),
  validateRequest(MilestoneValidations.updateMilestoneSchema),
  MilestoneControllers.updateMilestone,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.INSTRUCTOR, UserRoleEnum.ADMIN),
  MilestoneControllers.deleteMilestone,
);

export const MilestoneRoutes = router;
