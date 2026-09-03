import { z } from 'zod';

const createMilestoneSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  subtitle: z.string().min(1, 'Subtitle is required'),
  courseId: z.string().min(1, 'Course ID is required'),
});

const updateMilestoneSchema = z.object({
  title: z.string().min(1).optional(),
  subtitle: z.string().optional(),
  courseId: z.string().optional(),
});

export const MilestoneValidations = {
  createMilestoneSchema,
  updateMilestoneSchema,
};
