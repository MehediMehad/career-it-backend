import { UserRoleEnum } from '@prisma/client';
import express from 'express';

import { CourseControllers } from './course.controller';
import { CourseValidations } from './course.validation';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.INSTRUCTOR, UserRoleEnum.ADMIN),
  validateRequest(CourseValidations.createCourseSchema),
  CourseControllers.createCourse,
);

router.get('/', CourseControllers.getAllCourses);

router.get('/:id', CourseControllers.getSingleCourse);

router.patch(
  '/:id',
  auth(UserRoleEnum.INSTRUCTOR, UserRoleEnum.ADMIN),
  validateRequest(CourseValidations.updateCourseSchema),
  CourseControllers.updateCourse,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.INSTRUCTOR, UserRoleEnum.ADMIN),
  CourseControllers.deleteCourse,
);

export const CourseRoutes = router;
