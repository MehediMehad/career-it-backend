import { UserRoleEnum } from '@prisma/client';
import express from 'express';

import { StudentProfileControllers } from './student-profile.controller';
import { StudentProfileValidations } from './student-profile.validation';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';

const router = express.Router();

router.post(
  '/my-profile',
  auth(UserRoleEnum.STUDENT, UserRoleEnum.ADMIN),
  validateRequest(StudentProfileValidations.upsertStudentProfileSchema),
  StudentProfileControllers.upsertMyProfile,
);

router.get(
  '/my-profile',
  auth(UserRoleEnum.STUDENT, UserRoleEnum.ADMIN),
  StudentProfileControllers.getMyProfile,
);

router.patch(
  '/my-profile',
  auth(UserRoleEnum.STUDENT, UserRoleEnum.ADMIN),
  validateRequest(StudentProfileValidations.updateStudentProfileSchema),
  StudentProfileControllers.upsertMyProfile,
);

router.get('/', auth(UserRoleEnum.ADMIN), StudentProfileControllers.getAllStudentProfiles);

router.get('/:id', auth(UserRoleEnum.ADMIN), StudentProfileControllers.getSingleStudentProfile);

router.patch(
  '/:id',
  auth(UserRoleEnum.ADMIN),
  validateRequest(StudentProfileValidations.updateStudentProfileSchema),
  StudentProfileControllers.updateStudentProfile,
);

export const StudentProfileRoutes = router;
