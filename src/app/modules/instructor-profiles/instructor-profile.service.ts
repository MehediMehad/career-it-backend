import type { AdminApprovalStatus, InstructorProfile, Prisma } from '@prisma/client';
import httpStatus from 'http-status';

import type {
  ICreateInstructorProfile,
  IInstructorProfileFilterRequest,
  IUpdateInstructorProfile,
} from './instructor-profile.interface';
import ApiError from '../../errors/ApiError';
import { paginationHelper } from '../../helpers/paginationHelper';
import type { IPaginationOptions } from '../../interface/pagination.type';
import prisma from '../../libs/prisma';
import { redis } from '../../libs/redis';

const clearInstructorCache = async () => {
  try {
    const keys = await redis.keys('instructor_profiles:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    console.error('Redis clear instructor cache error:', error);
  }
};

const upsertMyProfile = async (
  userId: string,
  payload: ICreateInstructorProfile,
): Promise<InstructorProfile> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const profileData: Prisma.InstructorProfileCreateInput = {
    user: { connect: { id: userId } },
    bio: payload.bio,
    headline: payload.headline,
    expertiseArea: payload.expertiseArea,
    yearsOfExperience: payload.yearsOfExperience,
    Education: payload.Education,
    linkedinProfile: payload.linkedinProfile,
    portfolioWebsiteLink: payload.portfolioWebsiteLink,
  };

  const updateData: Prisma.InstructorProfileUpdateInput = {
    bio: payload.bio,
    headline: payload.headline,
    expertiseArea: payload.expertiseArea,
    yearsOfExperience: payload.yearsOfExperience,
    Education: payload.Education,
    linkedinProfile: payload.linkedinProfile,
    portfolioWebsiteLink: payload.portfolioWebsiteLink,
  };

  const result = await prisma.instructorProfile.upsert({
    where: { userId },
    create: profileData,
    update: updateData,
    include: {
      user: {
        select: {
          id: true,
          customId: true,
          name: true,
          email: true,
          image: true,
          role: true,
          status: true,
          isVerified: true,
        },
      },
    },
  });

  await clearInstructorCache();

  return result;
};

const getMyProfile = async (userId: string): Promise<InstructorProfile> => {
  const result = await prisma.instructorProfile.findUnique({
    where: { userId },
    include: {
      user: {
        select: {
          id: true,
          customId: true,
          name: true,
          email: true,
          image: true,
          role: true,
          status: true,
          isVerified: true,
        },
      },
      courses: {
        where: { isDeleted: false },
      },
    },
  });

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Instructor profile not found');
  }

  return result;
};

const getAllInstructorProfiles = async (
  filters: IInstructorProfileFilterRequest,
  options: IPaginationOptions,
  isAdmin = false,
) => {
  const cacheKey = `instructor_profiles:all:${isAdmin}:${JSON.stringify(filters)}:${JSON.stringify(options)}`;

  try {
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }
  } catch (error) {
    console.error('Redis read error:', error);
  }

  const { limit, page, skip, sortBy, sortOrder } = paginationHelper.calculatePagination(options);
  const { searchTerm, adminApproved, ...filterData } = filters;

  const andConditions: Prisma.InstructorProfileWhereInput[] = [];

  if (!isAdmin) {
    andConditions.push({ adminApproved: 'APPROVED' as AdminApprovalStatus });
  } else if (adminApproved) {
    andConditions.push({ adminApproved });
  }

  if (searchTerm) {
    andConditions.push({
      OR: [
        { headline: { contains: searchTerm, mode: 'insensitive' } },
        { bio: { contains: searchTerm, mode: 'insensitive' } },
        { Education: { contains: searchTerm, mode: 'insensitive' } },
        { expertiseArea: { hasSome: [searchTerm] } },
        { user: { name: { contains: searchTerm, mode: 'insensitive' } } },
        { user: { email: { contains: searchTerm, mode: 'insensitive' } } },
      ],
    });
  }

  if (Object.keys(filterData).length > 0) {
    andConditions.push({
      AND: Object.keys(filterData).map((key) => ({
        [key]: filterData[key as keyof typeof filterData],
      })),
    });
  }

  const whereConditions: Prisma.InstructorProfileWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const result = await prisma.instructorProfile.findMany({
    where: whereConditions,
    skip,
    take: limit,
    orderBy: {
      [sortBy]: sortOrder,
    },
    include: {
      user: {
        select: {
          id: true,
          customId: true,
          name: true,
          email: true,
          image: true,
          role: true,
          status: true,
          isVerified: true,
        },
      },
      _count: {
        select: { courses: { where: { isDeleted: false, isPublished: true } } },
      },
    },
  });

  const total = await prisma.instructorProfile.count({
    where: whereConditions,
  });

  const response = {
    meta: {
      total,
      page,
      limit,
      totalPage: Math.ceil(total / limit),
    },
    data: result,
  };

  try {
    await redis.set(cacheKey, JSON.stringify(response), 'EX', 3600); // Cache for 1 hour
  } catch (error) {
    console.error('Redis write error:', error);
  }

  return response;
};

const getSingleInstructorProfile = async (idOrUserId: string): Promise<InstructorProfile> => {
  const cacheKey = `instructor_profiles:single:${idOrUserId}`;

  try {
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }
  } catch (error) {
    console.error('Redis read error:', error);
  }

  const result = await prisma.instructorProfile.findFirst({
    where: {
      OR: [{ id: idOrUserId }, { userId: idOrUserId }],
    },
    include: {
      user: {
        select: {
          id: true,
          customId: true,
          name: true,
          email: true,
          image: true,
          role: true,
          status: true,
          isVerified: true,
        },
      },
      courses: {
        where: { isDeleted: false, isPublished: true },
        include: {
          category: true,
        },
      },
    },
  });

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Instructor profile not found');
  }

  try {
    await redis.set(cacheKey, JSON.stringify(result), 'EX', 3600);
  } catch (error) {
    console.error('Redis write error:', error);
  }

  return result;
};

const updateInstructorProfile = async (
  idOrUserId: string,
  payload: IUpdateInstructorProfile,
): Promise<InstructorProfile> => {
  const existingProfile = await prisma.instructorProfile.findFirst({
    where: {
      OR: [{ id: idOrUserId }, { userId: idOrUserId }],
    },
  });

  if (!existingProfile) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Instructor profile not found');
  }

  const result = await prisma.instructorProfile.update({
    where: { id: existingProfile.id },
    data: payload,
    include: {
      user: {
        select: {
          id: true,
          customId: true,
          name: true,
          email: true,
          image: true,
          role: true,
          status: true,
          isVerified: true,
        },
      },
    },
  });

  await clearInstructorCache();

  return result;
};

const updateAdminApprovalStatus = async (
  id: string,
  adminApproved: AdminApprovalStatus,
): Promise<InstructorProfile> => {
  const existingProfile = await prisma.instructorProfile.findUnique({
    where: { id },
  });

  if (!existingProfile) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Instructor profile not found');
  }

  const result = await prisma.instructorProfile.update({
    where: { id },
    data: { adminApproved },
  });

  await clearInstructorCache();

  return result;
};

export const InstructorProfileServices = {
  upsertMyProfile,
  getMyProfile,
  getAllInstructorProfiles,
  getSingleInstructorProfile,
  updateInstructorProfile,
  updateAdminApprovalStatus,
};
