import { UserRoleEnum } from '@prisma/client';
import express from 'express';

import { InstructorProfileControllers } from './instructor-profile.controller';
import { InstructorProfileValidations } from './instructor-profile.validation';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';

const router = express.Router();

router.post(
  '/my-profile',
  auth(UserRoleEnum.INSTRUCTOR, UserRoleEnum.ADMIN),
  validateRequest(InstructorProfileValidations.upsertInstructorProfileSchema),
  InstructorProfileControllers.upsertMyProfile,
);

router.get(
  '/my-profile',
  auth(UserRoleEnum.INSTRUCTOR, UserRoleEnum.ADMIN),
  InstructorProfileControllers.getMyProfile,
);

router.patch(
  '/my-profile',
  auth(UserRoleEnum.INSTRUCTOR, UserRoleEnum.ADMIN),
  validateRequest(InstructorProfileValidations.updateInstructorProfileSchema),
  InstructorProfileControllers.upsertMyProfile,
);

router.get('/', InstructorProfileControllers.getAllInstructorProfiles);

router.get('/:id', InstructorProfileControllers.getSingleInstructorProfile);

router.patch(
  '/:id',
  auth(UserRoleEnum.INSTRUCTOR, UserRoleEnum.ADMIN),
  validateRequest(InstructorProfileValidations.updateInstructorProfileSchema),
  InstructorProfileControllers.updateInstructorProfile,
);

router.patch(
  '/:id/status',
  auth(UserRoleEnum.ADMIN),
  validateRequest(InstructorProfileValidations.updateAdminApprovalStatusSchema),
  InstructorProfileControllers.updateAdminApprovalStatus,
);

export const InstructorProfileRoutes = router;
