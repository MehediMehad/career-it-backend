import { z } from 'zod';

const createModuleSchema = z.object({
  moduleNumber: z.number().int().positive('Module number must be a positive integer'),
  title: z.string().min(1, 'Title is required'),
  courseId: z.string().min(1, 'Course ID is required'),
  milestoneId: z.string().min(1, 'Milestone ID is required'),
});

const updateModuleSchema = z.object({
  moduleNumber: z.number().int().positive().optional(),
  title: z.string().min(1).optional(),
  courseId: z.string().optional(),
  milestoneId: z.string().optional(),
});

const reorderModulesSchema = z.object({
  courseId: z.string().min(1, 'Course ID is required'),
  milestoneId: z.string().min(1, 'Milestone ID is required'),
  items: z
    .array(
      z.object({
        id: z.string().min(1, 'Module ID is required'),
        moduleNumber: z.number().int().positive('Module number must be a positive integer'),
      }),
    )
    .min(1, 'At least one item is required'),
});

export const ModuleValidations = {
  createModuleSchema,
  updateModuleSchema,
  reorderModulesSchema,
};
