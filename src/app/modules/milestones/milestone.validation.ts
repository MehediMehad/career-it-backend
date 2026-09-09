import { z } from 'zod';

const createMilestoneSchema = z.object({
  milestoneNumber: z
    .number()
    .int()
    .positive('Milestone number must be a positive integer')
    .optional(),
  title: z.string().min(1, 'Title is required'),
  subtitle: z.string().min(1, 'Subtitle is required'),
  courseId: z.string().min(1, 'Course ID is required'),
});

const updateMilestoneSchema = z.object({
  milestoneNumber: z
    .number()
    .int()
    .positive('Milestone number must be a positive integer')
    .optional(),
  title: z.string().min(1).optional(),
  subtitle: z.string().optional(),
  courseId: z.string().optional(),
});

const reorderMilestonesSchema = z.object({
  courseId: z.string().min(1, 'Course ID is required'),
  items: z
    .array(
      z.object({
        id: z.string().min(1, 'Milestone ID is required'),
        milestoneNumber: z.number().int().positive('Milestone number must be positive'),
      }),
    )
    .min(1, 'At least one milestone item is required'),
});

export const MilestoneValidations = {
  createMilestoneSchema,
  updateMilestoneSchema,
  reorderMilestonesSchema,
};
