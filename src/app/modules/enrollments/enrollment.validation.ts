import { z } from 'zod';

const checkoutCourseSchema = z.object({
  courseId: z.string().uuid('Invalid Course ID format'),
});

const updateProgressSchema = z.object({
  progress: z.number().min(0).max(100, 'Progress must be between 0 and 100'),
});

export const EnrollmentValidations = {
  checkoutCourseSchema,
  updateProgressSchema,
};
