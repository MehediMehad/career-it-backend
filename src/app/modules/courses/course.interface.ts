import type { CourseLevelEnum } from '@prisma/client';

export interface ICourseFilterRequest {
  searchTerm?: string;
  categoryId?: string;
  instructorProfileId?: string;
  level?: CourseLevelEnum;
  isPublished?: string | boolean;
  isFeatured?: string | boolean;
  isDeleted?: string | boolean;
  minPrice?: string | number;
  maxPrice?: string | number;
}

export interface ICreateCourse {
  title: string;
  description: string;
  about: string;
  price?: number;
  level: CourseLevelEnum;
  requirements?: string[];
  learningOutcomes?: string[];
  categoryId: string;
  instructorProfileId?: string; // Optional if created by instructor themselves
  isPublished?: boolean;
  isFeatured?: boolean;
}

export interface IUpdateCourse {
  title?: string;
  description?: string;
  about?: string;
  price?: number;
  level?: CourseLevelEnum;
  requirements?: string[];
  learningOutcomes?: string[];
  categoryId?: string;
  instructorProfileId?: string;
  isPublished?: boolean;
  isFeatured?: boolean;
  isDeleted?: boolean;
}
