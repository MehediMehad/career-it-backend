import { CourseLevelEnum } from '@prisma/client';
import { z } from 'zod';

const createCourseSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  about: z.string().min(1, 'About section is required'),
  price: z.number().min(0).default(0.0),
  level: z.nativeEnum(CourseLevelEnum),
  requirements: z.array(z.string()).default([]),
  learningOutcomes: z.array(z.string()).default([]),
  categoryId: z.string().min(1, 'Category ID is required'),
  instructorProfileId: z.string().optional(),
  isPublished: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
});

const updateCourseSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  about: z.string().optional(),
  price: z.number().min(0).optional(),
  level: z.nativeEnum(CourseLevelEnum).optional(),
  requirements: z.array(z.string()).optional(),
  learningOutcomes: z.array(z.string()).optional(),
  categoryId: z.string().optional(),
  instructorProfileId: z.string().optional(),
  isPublished: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  isDeleted: z.boolean().optional(),
});

export const CourseValidations = {
  createCourseSchema,
  updateCourseSchema,
};
