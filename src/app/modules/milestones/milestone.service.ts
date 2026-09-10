import type { Milestone, Prisma } from '@prisma/client';
import { UserRoleEnum } from '@prisma/client';
import httpStatus from 'http-status';

import type {
  ICreateMilestone,
  IMilestoneFilterRequest,
  IReorderMilestonesPayload,
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
    const moduleKeys = await redis.keys('modules:*');
    const courseKeys = await redis.keys('courses:*');
    const lessonKeys = await redis.keys('lessons:*');

    const allKeys = [...milestoneKeys, ...moduleKeys, ...courseKeys, ...lessonKeys];
    if (allKeys.length > 0) {
      const uniqueKeys = [...new Set(allKeys)];
      await redis.del(...uniqueKeys);
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

  const milestoneCount = await prisma.milestone.count({
    where: { courseId: payload.courseId },
  });

  const milestoneNumber = payload.milestoneNumber ?? milestoneCount + 1;

  const result = await prisma.milestone.create({
    data: {
      ...payload,
      milestoneNumber,
    },
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
      [sortBy || 'milestoneNumber']: sortOrder || 'asc',
    },
    include: {
      course: {
        select: {
          id: true,
          title: true,
        },
      },
      modules: {
        orderBy: {
          moduleNumber: 'asc',
        },
        include: {
          lessons: {
            orderBy: {
              lessonNumber: 'asc',
            },
          },
        },
      },
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

const reorderMilestones = async (
  userPayload: TAccessTokenPayload,
  payload: IReorderMilestonesPayload,
): Promise<{ success: boolean; count: number }> => {
  const { courseId, items } = payload;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: { instructorProfile: true },
  });

  if (!course || course.isDeleted) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Course not found');
  }

  if (userPayload.role === UserRoleEnum.INSTRUCTOR) {
    if (course.instructorProfile.userId !== userPayload.userId) {
      throw new ApiError(httpStatus.FORBIDDEN, 'You can only reorder milestones of your own course');
    }
  }

  await prisma.$transaction(async (tx) => {
    // Phase 1: Set temporary negative milestoneNumbers to prevent collision
    for (let i = 0; i < items.length; i++) {
      await tx.milestone.update({
        where: { id: items[i].id },
        data: { milestoneNumber: -(i + 1) },
      });
    }

    // Phase 2: Set final milestone numbers
    for (const item of items) {
      await tx.milestone.update({
        where: { id: item.id },
        data: { milestoneNumber: item.milestoneNumber },
      });
    }
  });

  await clearMilestoneCache();

  return { success: true, count: items.length };
};

export const MilestoneServices = {
  createMilestone,
  getAllMilestones,
  getSingleMilestone,
  updateMilestone,
  deleteMilestone,
  reorderMilestones,
};
