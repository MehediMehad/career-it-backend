import type { GenderEnum } from '@prisma/client';

export interface IStudentProfileFilterRequest {
  searchTerm?: string;
  gender?: GenderEnum;
  institution?: string;
}

export interface ICreateStudentProfile {
  bio: string;
  dateOfBirth: string | Date;
  phoneNumber: string;
  whatsappNumber: string;
  gender: GenderEnum;
  education: string;
  institution: string;
  currentAddress?: Record<string, unknown> | unknown;
  permanentAddress?: Record<string, unknown> | unknown;
  importantLinks?: Record<string, unknown> | unknown;
  educationDetails?: Record<string, unknown> | unknown;
  extraDetails?: Record<string, unknown> | unknown;
  jobProfile?: Record<string, unknown> | unknown;
}

export interface IUpdateStudentProfile {
  bio?: string;
  dateOfBirth?: string | Date;
  phoneNumber?: string;
  whatsappNumber?: string;
  gender?: GenderEnum;
  education?: string;
  institution?: string;
  currentAddress?: Record<string, unknown> | unknown;
  permanentAddress?: Record<string, unknown> | unknown;
  importantLinks?: Record<string, unknown> | unknown;
  educationDetails?: Record<string, unknown> | unknown;
  extraDetails?: Record<string, unknown> | unknown;
  jobProfile?: Record<string, unknown> | unknown;
}
