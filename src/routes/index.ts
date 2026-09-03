import express from 'express';

import { AuthRoute } from '../app/modules/auth/auth.route';
import { CategoryRoutes } from '../app/modules/categories/category.route';
import { CourseRoutes } from '../app/modules/courses/course.route';
import { InstructorProfileRoutes } from '../app/modules/instructor-profiles/instructor-profile.route';
import { MilestoneRoutes } from '../app/modules/milestones/milestone.route';
import { ModuleRoutes } from '../app/modules/modules/module.route';
import { NotificationRoute } from '../app/modules/notification/notification.route';
import { StudentProfileRoutes } from '../app/modules/student-profiles/student-profile.route';
import { UploadRoutes } from '../app/modules/upload/upload.route';

const router = express.Router();

const moduleRoutes = [
  {
    path: '/auth',
    route: AuthRoute,
  },
  {
    path: '/categories',
    route: CategoryRoutes,
  },
  {
    path: '/notifications',
    route: NotificationRoute,
  },
  {
    path: '/uploads',
    route: UploadRoutes,
  },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
