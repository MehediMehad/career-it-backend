import { UserRoleEnum } from '@prisma/client';
import express from 'express';

import { EnrollmentControllers } from './enrollment.controller';
import { EnrollmentValidations } from './enrollment.validation';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';

const router = express.Router();

// Student Course Enrollment Checkout (Free or SSLCommerz Paid)
router.post(
  '/checkout',
  auth(UserRoleEnum.STUDENT, UserRoleEnum.ADMIN),
  validateRequest(EnrollmentValidations.checkoutCourseSchema),
  EnrollmentControllers.checkoutCourse,
);

// Student's Enrolled Courses List
router.get(
  '/my-courses',
  auth(UserRoleEnum.STUDENT, UserRoleEnum.ADMIN),
  EnrollmentControllers.getMyEnrollments,
);

// Check if currently logged in user is enrolled in a specific course
router.get(
  '/status/:courseId',
  auth(UserRoleEnum.STUDENT, UserRoleEnum.ADMIN, UserRoleEnum.INSTRUCTOR),
  EnrollmentControllers.checkEnrollmentStatus,
);

// Update lesson/course progress
router.patch(
  '/progress/:courseId',
  auth(UserRoleEnum.STUDENT, UserRoleEnum.ADMIN),
  validateRequest(EnrollmentValidations.updateProgressSchema),
  EnrollmentControllers.updateProgress,
);

export const EnrollmentRoutes = router;
