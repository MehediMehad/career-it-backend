import type { AdminApprovalStatus } from '@prisma/client';

export interface IInstructorProfileFilterRequest {
  searchTerm?: string;
  adminApproved?: AdminApprovalStatus;
}

export interface ICreateInstructorProfile {
  name: string;
  image?: string;
  bio: string;
  headline: string;
  expertiseArea: string[];
  yearsOfExperience: number;
  education: string;
  linkedinProfile?: string;
  portfolioWebsiteLink?: string;
}

export interface IUpdateInstructorProfile {
  name: string;
  image?: string;
  bio?: string;
  headline?: string;
  expertiseArea?: string[];
  yearsOfExperience?: number;
  education?: string;
  linkedinProfile?: string;
  portfolioWebsiteLink?: string;
}

export interface IUpdateAdminApprovalStatus {
  adminApproved: AdminApprovalStatus;
}
