import type { AdminApprovalStatus } from '@prisma/client';

export interface IInstructorProfileFilterRequest {
  searchTerm?: string;
  adminApproved?: AdminApprovalStatus;
}

export interface ICreateInstructorProfile {
  bio: string;
  headline: string;
  expertiseArea: string[];
  yearsOfExperience: number;
  Education: string;
  linkedinProfile?: string;
  portfolioWebsiteLink?: string;
}

export interface IUpdateInstructorProfile {
  bio?: string;
  headline?: string;
  expertiseArea?: string[];
  yearsOfExperience?: number;
  Education?: string;
  linkedinProfile?: string;
  portfolioWebsiteLink?: string;
}

export interface IUpdateAdminApprovalStatus {
  adminApproved: AdminApprovalStatus;
}
