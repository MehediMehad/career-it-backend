import type { Milestone, Prisma } from '@prisma/client';
import { UserRoleEnum } from '@prisma/client';
import httpStatus from 'http-status';

import type {
  ICreateMilestone,
  IMilestoneFilterRequest,
  IUpdateMilestone,
} from './milestone.interface';
import ApiError from '../../errors/ApiError';
import { paginationHelper } from '../../helpers/paginationHelper';
import type { TAccessTokenPayload } from '../../interface';
import type { IPaginationOptions } from '../../interface/pagination.type';
import prisma from '../../libs/prisma';
import { redis } from '../../libs/redis';

const clearMilestoneCache = async () => {
  try {
    const milestoneKeys = await redis.keys('milestones:*');
    if (milestoneKeys.length > 0) {
      await redis.del(...milestoneKeys);
    }
    const courseKeys = await redis.keys('courses:*');
    if (courseKeys.length > 0) {
      await redis.del(...courseKeys);
    }
  } catch (error) {
    console.error('Redis clear milestone cache error:', error);
  }
};

const createMilestone = async (
  userPayload: TAccessTokenPayload,
  payload: ICreateMilestone,
): Promise<Milestone> => {
  const course = await prisma.course.findUnique({
    where: { id: payload.courseId },
    include: { instructorProfile: true },
  });

  if (!course || course.isDeleted) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Course not found');
  }

  if (userPayload.role === UserRoleEnum.INSTRUCTOR) {
    if (course.instructorProfile.userId !== userPayload.userId) {
      throw new ApiError(httpStatus.FORBIDDEN, 'You can only add milestones to your own course');
    }
  }

  const result = await prisma.milestone.create({
    data: payload,
    include: {
      course: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });

  await clearMilestoneCache();

  return result;
};

const getAllMilestones = async (filters: IMilestoneFilterRequest, options: IPaginationOptions) => {
  const cacheKey = `milestones:all:${JSON.stringify(filters)}:${JSON.stringify(options)}`;

  try {
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }
  } catch (error) {
    console.error('Redis read error:', error);
  }

  const { limit, page, skip, sortBy, sortOrder } = paginationHelper.calculatePagination(options);
  const { searchTerm, courseId, ...filterData } = filters;

  const andConditions: Prisma.MilestoneWhereInput[] = [];

  if (courseId) {
    andConditions.push({ courseId });
  }

  if (searchTerm) {
    andConditions.push({
      OR: [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { subtitle: { contains: searchTerm, mode: 'insensitive' } },
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

  const whereConditions: Prisma.MilestoneWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const result = await prisma.milestone.findMany({
    where: whereConditions,
    skip,
    take: limit,
    orderBy: {
      [sortBy]: sortOrder,
    },
    include: {
      course: {
        select: {
          id: true,
          title: true,
        },
      },
      modules: true,
    },
  });

  const total = await prisma.milestone.count({
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
    await redis.set(cacheKey, JSON.stringify(response), 'EX', 3600); // 1 hour TTL
  } catch (error) {
    console.error('Redis write error:', error);
  }

  return response;
};

const getSingleMilestone = async (id: string): Promise<Milestone> => {
  const cacheKey = `milestones:single:${id}`;

  try {
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }
  } catch (error) {
    console.error('Redis read error:', error);
  }

  const result = await prisma.milestone.findUnique({
    where: { id },
    include: {
      course: {
        select: {
          id: true,
          title: true,
        },
      },
      modules: {
        include: {
          lessons: true,
        },
      },
    },
  });

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Milestone not found');
  }

  try {
    await redis.set(cacheKey, JSON.stringify(result), 'EX', 3600); // 1 hour TTL
  } catch (error) {
    console.error('Redis write error:', error);
  }

  return result;
};

const updateMilestone = async (
  userPayload: TAccessTokenPayload,
  id: string,
  payload: IUpdateMilestone,
): Promise<Milestone> => {
  const milestone = await prisma.milestone.findUnique({
    where: { id },
    include: { course: { include: { instructorProfile: true } } },
  });

  if (!milestone) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Milestone not found');
  }

  if (userPayload.role === UserRoleEnum.INSTRUCTOR) {
    if (milestone.course.instructorProfile.userId !== userPayload.userId) {
      throw new ApiError(httpStatus.FORBIDDEN, 'You can only update milestones of your own course');
    }
  }

  const result = await prisma.milestone.update({
    where: { id },
    data: payload,
    include: {
      course: {
        select: {
          id: true,
          title: true,
        },
      },
      modules: true,
    },
  });

  await clearMilestoneCache();

  return result;
};

const deleteMilestone = async (
  userPayload: TAccessTokenPayload,
  id: string,
): Promise<Milestone> => {
  const milestone = await prisma.milestone.findUnique({
    where: { id },
    include: { course: { include: { instructorProfile: true } } },
  });

  if (!milestone) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Milestone not found');
  }

  if (userPayload.role === UserRoleEnum.INSTRUCTOR) {
    if (milestone.course.instructorProfile.userId !== userPayload.userId) {
      throw new ApiError(httpStatus.FORBIDDEN, 'You can only delete milestones of your own course');
    }
  }

  const result = await prisma.milestone.delete({
    where: { id },
  });

  await clearMilestoneCache();

  return result;
};

export const MilestoneServices = {
  createMilestone,
  getAllMilestones,
  getSingleMilestone,
  updateMilestone,
  deleteMilestone,
};
