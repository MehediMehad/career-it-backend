import { z } from 'zod';

const createCategorySchema = z.object({
  title: z.string().min(1, 'Title is required'),
  image: z.string().optional(),
});

const updateCategorySchema = z.object({
  title: z.string().min(1, 'Title cannot be empty').optional(),
  image: z.string().optional(),
  isDeleted: z.boolean().optional(),
});

export const CategoryValidations = {
  createCategorySchema,
  updateCategorySchema,
};
