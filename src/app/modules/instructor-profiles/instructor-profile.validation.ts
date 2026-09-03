import { AdminApprovalStatus } from '@prisma/client';
import { z } from 'zod';

const upsertInstructorProfileSchema = z.object({
  bio: z.string().min(1, 'Bio is required'),
  headline: z.string().min(1, 'Headline is required'),
  expertiseArea: z.array(z.string()).min(1, 'Expertise area is required'),
  yearsOfExperience: z.number().min(0, 'Years of experience is required'),
  Education: z.string().min(1, 'Education is required'),
  linkedinProfile: z.string().optional(),
  portfolioWebsiteLink: z.string().optional(),
});

const updateInstructorProfileSchema = z.object({
  bio: z.string().optional(),
  headline: z.string().optional(),
  expertiseArea: z.array(z.string()).optional(),
  yearsOfExperience: z.number().min(0).optional(),
  Education: z.string().optional(),
  linkedinProfile: z.string().optional(),
  portfolioWebsiteLink: z.string().optional(),
});

const updateAdminApprovalStatusSchema = z.object({
  adminApproved: z.nativeEnum(AdminApprovalStatus),
});

export const InstructorProfileValidations = {
  upsertInstructorProfileSchema,
  updateInstructorProfileSchema,
  updateAdminApprovalStatusSchema,
};
