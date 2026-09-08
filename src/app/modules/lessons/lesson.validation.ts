import { LessonTypeEnum, VideoProviderEnum } from '@prisma/client';
import { z } from 'zod';

const createLessonSchema = z.object({
  lessonNumber: z.number().int().positive('Lesson number must be positive'),
  title: z.string().min(1, 'Title is required'),
  lessonType: z.nativeEnum(LessonTypeEnum),
  videoProvider: z.nativeEnum(VideoProviderEnum).optional(),
  videoKey: z.string().optional().nullable(),
  videoUrl: z.string().optional().nullable(),
  duration: z.number().int().nonnegative().optional().nullable(),
  isFreePreview: z.boolean().optional(),
  moduleId: z.string().min(1, 'Module ID is required'),
});

const updateLessonSchema = z.object({
  lessonNumber: z.number().int().positive().optional(),
  title: z.string().min(1).optional(),
  lessonType: z.nativeEnum(LessonTypeEnum).optional(),
  videoProvider: z.nativeEnum(VideoProviderEnum).optional(),
  videoKey: z.string().optional().nullable(),
  videoUrl: z.string().optional().nullable(),
  duration: z.number().int().nonnegative().optional().nullable(),
  isFreePreview: z.boolean().optional(),
});

export const LessonValidations = {
  createLessonSchema,
  updateLessonSchema,
};

