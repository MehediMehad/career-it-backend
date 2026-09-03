import { GenderEnum } from '@prisma/client';
import { z } from 'zod';

const upsertStudentProfileSchema = z.object({
  bio: z.string().min(1, 'Bio is required'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  phoneNumber: z.string().min(1, 'Phone number is required'),
  whatsappNumber: z.string().min(1, 'WhatsApp number is required'),
  gender: z.nativeEnum(GenderEnum),
  education: z.string().min(1, 'Education is required'),
  institution: z.string().min(1, 'Institution is required'),
  currentAddress: z.record(z.string(), z.any()).default({}),
  permanentAddress: z.record(z.string(), z.any()).default({}),
  importantLinks: z.record(z.string(), z.any()).default({}),
  educationDetails: z.record(z.string(), z.any()).default({}),
  extraDetails: z.record(z.string(), z.any()).default({}),
  jobProfile: z.record(z.string(), z.any()).default({}),
});

const updateStudentProfileSchema = z.object({
  bio: z.string().optional(),
  dateOfBirth: z.string().optional(),
  phoneNumber: z.string().optional(),
  whatsappNumber: z.string().optional(),
  gender: z.nativeEnum(GenderEnum).optional(),
  education: z.string().optional(),
  institution: z.string().optional(),
  currentAddress: z.record(z.string(), z.any()).optional(),
  permanentAddress: z.record(z.string(), z.any()).optional(),
  importantLinks: z.record(z.string(), z.any()).optional(),
  educationDetails: z.record(z.string(), z.any()).optional(),
  extraDetails: z.record(z.string(), z.any()).optional(),
  jobProfile: z.record(z.string(), z.any()).optional(),
});

export const StudentProfileValidations = {
  upsertStudentProfileSchema,
  updateStudentProfileSchema,
};
