import type { Module, Prisma } from '@prisma/client';
import { UserRoleEnum } from '@prisma/client';
import httpStatus from 'http-status';

import type { ICreateModule, IModuleFilterRequest, IUpdateModule } from './module.interface';
import ApiError from '../../errors/ApiError';
import { paginationHelper } from '../../helpers/paginationHelper';
import type { TAccessTokenPayload } from '../../interface';
import type { IPaginationOptions } from '../../interface/pagination.type';
import prisma from '../../libs/prisma';
import { redis } from '../../libs/redis';

const clearModuleCache = async () => {
  try {
    const moduleKeys = await redis.keys('modules:*');
    if (moduleKeys.length > 0) {
      await redis.del(...moduleKeys);
    }
    const milestoneKeys = await redis.keys('milestones:*');
    if (milestoneKeys.length > 0) {
      await redis.del(...milestoneKeys);
    }
    const courseKeys = await redis.keys('courses:*');
    if (courseKeys.length > 0) {
      await redis.del(...courseKeys);
    }
  } catch (error) {
    console.error('Redis clear module cache error:', error);
  }
};

const createModule = async (
  userPayload: TAccessTokenPayload,
  payload: ICreateModule,
): Promise<Module> => {
  const course = await prisma.course.findUnique({
    where: { id: payload.courseId },
    include: { instructorProfile: true },
  });

  if (!course || course.isDeleted) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Course not found');
  }

  if (userPayload.role === UserRoleEnum.INSTRUCTOR) {
    if (course.instructorProfile.userId !== userPayload.userId) {
      throw new ApiError(httpStatus.FORBIDDEN, 'You can only add modules to your own course');
    }
  }

  const milestone = await prisma.milestone.findUnique({
    where: { id: payload.milestoneId },
  });

  if (!milestone) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Milestone not found');
  }

  const existingModuleNumber = await prisma.module.findUnique({
    where: { moduleNumber: payload.moduleNumber },
  });

  if (existingModuleNumber) {
    throw new ApiError(httpStatus.CONFLICT, 'Module number already exists');
  }

  const result = await prisma.$transaction(async (tx) => {
    const newModule = await tx.module.create({
      data: payload,
      include: {
        milestone: true,
        course: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    await tx.milestone.update({
      where: { id: payload.milestoneId },
      data: { moduleCount: { increment: 1 } },
    });

    return newModule;
  });

  await clearModuleCache();

  return result;
};

const getAllModules = async (filters: IModuleFilterRequest, options: IPaginationOptions) => {
  const cacheKey = `modules:all:${JSON.stringify(filters)}:${JSON.stringify(options)}`;

  try {
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }
  } catch (error) {
    console.error('Redis read error:', error);
  }

  const { limit, page, skip, sortBy, sortOrder } = paginationHelper.calculatePagination(options);
  const { searchTerm, courseId, milestoneId, ...filterData } = filters;

  const andConditions: Prisma.ModuleWhereInput[] = [];

  if (courseId) {
    andConditions.push({ courseId });
  }

  if (milestoneId) {
    andConditions.push({ milestoneId });
  }

  if (searchTerm) {
    andConditions.push({
      title: { contains: searchTerm, mode: 'insensitive' },
    });
  }

  if (Object.keys(filterData).length > 0) {
    andConditions.push({
      AND: Object.keys(filterData).map((key) => ({
        [key]: filterData[key as keyof typeof filterData],
      })),
    });
  }

  const whereConditions: Prisma.ModuleWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const result = await prisma.module.findMany({
    where: whereConditions,
    skip,
    take: limit,
    orderBy: {
      [sortBy]: sortOrder,
    },
    include: {
      milestone: true,
      course: {
        select: {
          id: true,
          title: true,
        },
      },
      lessons: true,
    },
  });

  const total = await prisma.module.count({
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

const getSingleModule = async (id: string): Promise<Module> => {
  const cacheKey = `modules:single:${id}`;

  try {
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }
  } catch (error) {
    console.error('Redis read error:', error);
  }

  const result = await prisma.module.findUnique({
    where: { id },
    include: {
      milestone: true,
      course: {
        select: {
          id: true,
          title: true,
        },
      },
      lessons: true,
    },
  });

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Module not found');
  }

  try {
    await redis.set(cacheKey, JSON.stringify(result), 'EX', 3600); // 1 hour TTL
  } catch (error) {
    console.error('Redis write error:', error);
  }

  return result;
};

const updateModule = async (
  userPayload: TAccessTokenPayload,
  id: string,
  payload: IUpdateModule,
): Promise<Module> => {
  const moduleItem = await prisma.module.findUnique({
    where: { id },
    include: { course: { include: { instructorProfile: true } } },
  });

  if (!moduleItem) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Module not found');
  }

  if (userPayload.role === UserRoleEnum.INSTRUCTOR) {
    if (moduleItem.course.instructorProfile.userId !== userPayload.userId) {
      throw new ApiError(httpStatus.FORBIDDEN, 'You can only update modules of your own course');
    }
  }

  if (payload.moduleNumber && payload.moduleNumber !== moduleItem.moduleNumber) {
    const existing = await prisma.module.findUnique({
      where: { moduleNumber: payload.moduleNumber },
    });
    if (existing) {
      throw new ApiError(httpStatus.CONFLICT, 'Module number already exists');
    }
  }

  const result = await prisma.module.update({
    where: { id },
    data: payload,
    include: {
      milestone: true,
      course: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });

  await clearModuleCache();

  return result;
};

const deleteModule = async (userPayload: TAccessTokenPayload, id: string): Promise<Module> => {
  const moduleItem = await prisma.module.findUnique({
    where: { id },
    include: { course: { include: { instructorProfile: true } } },
  });

  if (!moduleItem) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Module not found');
  }

  if (userPayload.role === UserRoleEnum.INSTRUCTOR) {
    if (moduleItem.course.instructorProfile.userId !== userPayload.userId) {
      throw new ApiError(httpStatus.FORBIDDEN, 'You can only delete modules of your own course');
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const deleted = await tx.module.delete({
      where: { id },
    });

    await tx.milestone.update({
      where: { id: moduleItem.milestoneId },
      data: { moduleCount: { decrement: 1 } },
    });

    return deleted;
  });

  await clearModuleCache();

  return result;
};

export const ModuleServices = {
  createModule,
  getAllModules,
  getSingleModule,
  updateModule,
  deleteModule,
};
