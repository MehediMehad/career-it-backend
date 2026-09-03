import type { Prisma, StudentProfile } from '@prisma/client';
import httpStatus from 'http-status';

import type {
  ICreateStudentProfile,
  IStudentProfileFilterRequest,
  IUpdateStudentProfile,
} from './student-profile.interface';
import ApiError from '../../errors/ApiError';
import { paginationHelper } from '../../helpers/paginationHelper';
import type { IPaginationOptions } from '../../interface/pagination.type';
import prisma from '../../libs/prisma';
import { redis } from '../../libs/redis';

const clearStudentCache = async (userId?: string, profileId?: string) => {
  try {
    if (userId) {
      await redis.del(`student_profile:my:${userId}`);
    }
    if (profileId) {
      await redis.del(`student_profile:single:${profileId}`);
    }
    const keys = await redis.keys('student_profile:all:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    console.error('Redis clear student cache error:', error);
  }
};

const upsertMyProfile = async (
  userId: string,
  payload: ICreateStudentProfile,
): Promise<StudentProfile> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const dateOfBirth = new Date(payload.dateOfBirth);

  const profileData: Prisma.StudentProfileCreateInput = {
    user: { connect: { id: userId } },
    bio: payload.bio,
    dateOfBirth,
    phoneNumber: payload.phoneNumber,
    whatsappNumber: payload.whatsappNumber,
    gender: payload.gender,
    education: payload.education,
    institution: payload.institution,
    currentAddress: (payload.currentAddress ?? {}) as Prisma.InputJsonValue,
    permanentAddress: (payload.permanentAddress ?? {}) as Prisma.InputJsonValue,
    importantLinks: (payload.importantLinks ?? {}) as Prisma.InputJsonValue,
    educationDetails: (payload.educationDetails ?? {}) as Prisma.InputJsonValue,
    extraDetails: (payload.extraDetails ?? {}) as Prisma.InputJsonValue,
    jobProfile: (payload.jobProfile ?? {}) as Prisma.InputJsonValue,
  };

  const updateData: Prisma.StudentProfileUpdateInput = {
    bio: payload.bio,
    dateOfBirth,
    phoneNumber: payload.phoneNumber,
    whatsappNumber: payload.whatsappNumber,
    gender: payload.gender,
    education: payload.education,
    institution: payload.institution,
    currentAddress: (payload.currentAddress ?? {}) as Prisma.InputJsonValue,
    permanentAddress: (payload.permanentAddress ?? {}) as Prisma.InputJsonValue,
    importantLinks: (payload.importantLinks ?? {}) as Prisma.InputJsonValue,
    educationDetails: (payload.educationDetails ?? {}) as Prisma.InputJsonValue,
    extraDetails: (payload.extraDetails ?? {}) as Prisma.InputJsonValue,
    jobProfile: (payload.jobProfile ?? {}) as Prisma.InputJsonValue,
  };

  const result = await prisma.studentProfile.upsert({
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

  await clearStudentCache(userId, result.id);

  return result;
};

const getMyProfile = async (userId: string): Promise<StudentProfile> => {
  const cacheKey = `student_profile:my:${userId}`;

  try {
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }
  } catch (error) {
    console.error('Redis read error:', error);
  }

  const result = await prisma.studentProfile.findUnique({
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
    },
  });

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Student profile not found');
  }

  try {
    await redis.set(cacheKey, JSON.stringify(result), 'EX', 3600);
  } catch (error) {
    console.error('Redis write error:', error);
  }

  return result;
};

const getAllStudentProfiles = async (
  filters: IStudentProfileFilterRequest,
  options: IPaginationOptions,
) => {
  const cacheKey = `student_profile:all:${JSON.stringify(filters)}:${JSON.stringify(options)}`;

  try {
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }
  } catch (error) {
    console.error('Redis read error:', error);
  }

  const { limit, page, skip, sortBy, sortOrder } = paginationHelper.calculatePagination(options);
  const { searchTerm, ...filterData } = filters;

  const andConditions: Prisma.StudentProfileWhereInput[] = [];

  if (searchTerm) {
    andConditions.push({
      OR: [
        { phoneNumber: { contains: searchTerm, mode: 'insensitive' } },
        { institution: { contains: searchTerm, mode: 'insensitive' } },
        { education: { contains: searchTerm, mode: 'insensitive' } },
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

  const whereConditions: Prisma.StudentProfileWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const result = await prisma.studentProfile.findMany({
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
    },
  });

  const total = await prisma.studentProfile.count({
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
    await redis.set(cacheKey, JSON.stringify(response), 'EX', 1800); // 30 mins
  } catch (error) {
    console.error('Redis write error:', error);
  }

  return response;
};

const getSingleStudentProfile = async (idOrUserId: string): Promise<StudentProfile> => {
  const cacheKey = `student_profile:single:${idOrUserId}`;

  try {
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }
  } catch (error) {
    console.error('Redis read error:', error);
  }

  const result = await prisma.studentProfile.findFirst({
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
    },
  });

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Student profile not found');
  }

  try {
    await redis.set(cacheKey, JSON.stringify(result), 'EX', 3600);
  } catch (error) {
    console.error('Redis write error:', error);
  }

  return result;
};

const updateStudentProfile = async (
  idOrUserId: string,
  payload: IUpdateStudentProfile,
): Promise<StudentProfile> => {
  const existingProfile = await prisma.studentProfile.findFirst({
    where: {
      OR: [{ id: idOrUserId }, { userId: idOrUserId }],
    },
  });

  if (!existingProfile) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Student profile not found');
  }

  const updateData: Prisma.StudentProfileUpdateInput = {};

  if (payload.bio !== undefined) updateData.bio = payload.bio;
  if (payload.dateOfBirth !== undefined) updateData.dateOfBirth = new Date(payload.dateOfBirth);
  if (payload.phoneNumber !== undefined) updateData.phoneNumber = payload.phoneNumber;
  if (payload.whatsappNumber !== undefined) updateData.whatsappNumber = payload.whatsappNumber;
  if (payload.gender !== undefined) updateData.gender = payload.gender;
  if (payload.education !== undefined) updateData.education = payload.education;
  if (payload.institution !== undefined) updateData.institution = payload.institution;
  if (payload.currentAddress !== undefined)
    updateData.currentAddress = payload.currentAddress as Prisma.InputJsonValue;
  if (payload.permanentAddress !== undefined)
    updateData.permanentAddress = payload.permanentAddress as Prisma.InputJsonValue;
  if (payload.importantLinks !== undefined)
    updateData.importantLinks = payload.importantLinks as Prisma.InputJsonValue;
  if (payload.educationDetails !== undefined)
    updateData.educationDetails = payload.educationDetails as Prisma.InputJsonValue;
  if (payload.extraDetails !== undefined)
    updateData.extraDetails = payload.extraDetails as Prisma.InputJsonValue;
  if (payload.jobProfile !== undefined)
    updateData.jobProfile = payload.jobProfile as Prisma.InputJsonValue;

  const result = await prisma.studentProfile.update({
    where: { id: existingProfile.id },
    data: updateData,
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

  await clearStudentCache(existingProfile.userId, existingProfile.id);

  return result;
};

export const StudentProfileServices = {
  upsertMyProfile,
  getMyProfile,
  getAllStudentProfiles,
  getSingleStudentProfile,
  updateStudentProfile,
};
