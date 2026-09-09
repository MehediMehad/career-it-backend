import { UserRoleEnum } from '@prisma/client';
import express from 'express';

import { LessonControllers } from './lesson.controller';
import { LessonValidations } from './lesson.validation';
import auth from '../../middlewares/auth';
import optionalAuth from '../../middlewares/optionalAuth';
import validateRequest from '../../middlewares/validateRequest';

const router = express.Router();

// 1. Create Lesson (Instructor or Admin)
router.post(
  '/',
  auth(UserRoleEnum.INSTRUCTOR, UserRoleEnum.ADMIN),
  validateRequest(LessonValidations.createLessonSchema),
  LessonControllers.createLesson,
);

// 2. Get All Lessons of a Module
router.get('/module/:moduleId', LessonControllers.getAllLessonsByModule);

// 3. Get Lesson Playback URL (Direct S3 Presigned URL or External Video)
// Uses optionalAuth so free preview lessons are accessible to guests, while premium requires auth
router.get('/:id/playback', optionalAuth, LessonControllers.getLessonPlayback);

// 4. Get Single Lesson Details
router.get('/:id', LessonControllers.getSingleLesson);

// 5. Reorder Lessons in a Module (Instructor or Admin)
router.patch(
  '/reorder',
  auth(UserRoleEnum.INSTRUCTOR, UserRoleEnum.ADMIN),
  validateRequest(LessonValidations.reorderLessonsSchema),
  LessonControllers.reorderLessons,
);

// 6. Update Lesson (Instructor or Admin)
router.patch(
  '/:id',
  auth(UserRoleEnum.INSTRUCTOR, UserRoleEnum.ADMIN),
  validateRequest(LessonValidations.updateLessonSchema),
  LessonControllers.updateLesson,
);

// 6. Delete Lesson (Instructor or Admin)
router.delete(
  '/:id',
  auth(UserRoleEnum.INSTRUCTOR, UserRoleEnum.ADMIN),
  LessonControllers.deleteLesson,
);

export const LessonRoutes = router;

