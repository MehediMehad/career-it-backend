import type { Course, Prisma } from '@prisma/client';
import { UserRoleEnum } from '@prisma/client';
import httpStatus from 'http-status';

import type { ICourseFilterRequest, ICreateCourse, IUpdateCourse } from './course.interface';
import ApiError from '../../errors/ApiError';
import { paginationHelper } from '../../helpers/paginationHelper';
import type { TAccessTokenPayload } from '../../interface';
import type { IPaginationOptions } from '../../interface/pagination.type';
import prisma from '../../libs/prisma';
import { redis } from '../../libs/redis';

const clearCourseCache = async () => {
  try {
    const courseKeys = await redis.keys('courses:*');
    if (courseKeys.length > 0) {
      await redis.del(...courseKeys);
    }
    const categoryKeys = await redis.keys('categories:*');
    if (categoryKeys.length > 0) {
      await redis.del(...categoryKeys);
    }
  } catch (error) {
    console.error('Redis clear course cache error:', error);
  }
};

const createCourse = async (
  userPayload: TAccessTokenPayload,
  payload: ICreateCourse,
): Promise<Course> => {
  let instructorProfileId = payload.instructorProfileId;

  if (userPayload.role === UserRoleEnum.INSTRUCTOR) {
    const instructorProfile = await prisma.instructorProfile.findUnique({
      where: { userId: userPayload.userId },
    });
    if (!instructorProfile) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        'Instructor profile not updated! Please update your profile.',
      );
    }
    instructorProfileId = instructorProfile.id;
  }

  if (!instructorProfileId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Instructor profile ID is required');
  }

  // Verify category exists
  const category = await prisma.category.findUnique({
    where: { id: payload.categoryId },
  });
  if (!category) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Category not found');
  }

  // Transaction to create course and update category courseCount
  const result = await prisma.$transaction(async (tx) => {
    const newCourse = await tx.course.create({
      data: {
        image: payload.image,
        title: payload.title,
        description: payload.description,
        about: payload.about,
        price: payload.price ?? 0.0,
        level: payload.level,
        requirements: payload.requirements ?? [],
        learningOutcomes: payload.learningOutcomes ?? [],
        isPublished: payload.isPublished ?? false,
        isFeatured: payload.isFeatured ?? false,
        categoryId: payload.categoryId,
        instructorProfileId: instructorProfileId!,
      },
    });

    await tx.category.update({
      where: { id: payload.categoryId },
      data: {
        courseCount: { increment: 1 },
      },
    });

    return newCourse;
  });

  await clearCourseCache();

  return result;
};

const getAllCourses = async (
  filters: ICourseFilterRequest,
  options: IPaginationOptions,
  userRole?: UserRoleEnum,
) => {
  const cacheKey = `courses:all:${userRole || 'public'}:${JSON.stringify(filters)}:${JSON.stringify(options)}`;

  try {
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }
  } catch (error) {
    console.error('Redis read error:', error);
  }

  const { limit, page, skip, sortBy, sortOrder } = paginationHelper.calculatePagination(options);
  const {
    searchTerm,
    categoryId,
    instructorProfileId,
    level,
    isPublished,
    isFeatured,
    isDeleted,
    minPrice,
    maxPrice,
  } = filters;

  const andConditions: Prisma.CourseWhereInput[] = [];

  // Default filtering for public users
  if (userRole !== UserRoleEnum.ADMIN && userRole !== UserRoleEnum.INSTRUCTOR) {
    andConditions.push({ isDeleted: false });
    andConditions.push({ isPublished: true });
  } else {
    if (isDeleted !== undefined) {
      andConditions.push({
        isDeleted: isDeleted === 'true' || isDeleted === true,
      });
    } else {
      andConditions.push({ isDeleted: false });
    }
    if (isPublished !== undefined) {
      andConditions.push({
        isPublished: isPublished === 'true' || isPublished === true,
      });
    }
  }

  if (searchTerm) {
    andConditions.push({
      OR: [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
        { about: { contains: searchTerm, mode: 'insensitive' } },
      ],
    });
  }

  if (categoryId) {
    andConditions.push({ categoryId });
  }

  if (instructorProfileId) {
    andConditions.push({ instructorProfileId });
  }

  if (level) {
    andConditions.push({ level });
  }

  if (isFeatured !== undefined) {
    andConditions.push({
      isFeatured: isFeatured === 'true' || isFeatured === true,
    });
  }

  if (minPrice !== undefined || maxPrice !== undefined) {
    const priceCondition: Prisma.DecimalFilter = {};
    if (minPrice !== undefined) priceCondition.gte = Number(minPrice);
    if (maxPrice !== undefined) priceCondition.lte = Number(maxPrice);
    andConditions.push({ price: priceCondition });
  }

  const whereConditions: Prisma.CourseWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const result = await prisma.course.findMany({
    where: whereConditions,
    skip,
    take: limit,
    orderBy: {
      [sortBy]: sortOrder,
    },
    include: {
      category: {
        select: {
          id: true,
          title: true,
          slug: true,
          image: true,
        },
      },
      instructorProfile: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      },
    },
  });

  const total = await prisma.course.count({
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

const getSingleCourse = async (id: string): Promise<Course> => {
  const cacheKey = `courses:single:${id}`;

  try {
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }
  } catch (error) {
    console.error('Redis read error:', error);
  }

  const result = await prisma.course.findUnique({
    where: { id },
    include: {
      category: true,
      instructorProfile: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      },
      milestones: {
        include: {
          modules: {
            include: {
              lessons: true,
            },
          },
        },
      },
      modules: {
        include: {
          lessons: true,
        },
      },
    },
  });

  if (!result || result.isDeleted) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Course not found');
  }

  try {
    await redis.set(cacheKey, JSON.stringify(result), 'EX', 3600); // 1 hour TTL
  } catch (error) {
    console.error('Redis write error:', error);
  }

  return result;
};

const updateCourse = async (
  userPayload: TAccessTokenPayload,
  id: string,
  payload: IUpdateCourse,
): Promise<Course> => {
  const course = await prisma.course.findUnique({
    where: { id },
    include: { instructorProfile: true },
  });

  if (!course || course.isDeleted) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Course not found');
  }

  // Permission check for instructor
  if (userPayload.role === UserRoleEnum.INSTRUCTOR) {
    if (course.instructorProfile.userId !== userPayload.userId) {
      throw new ApiError(httpStatus.FORBIDDEN, 'You can only update your own courses');
    }
  }

  // Category count update if categoryId changed
  const result = await prisma.$transaction(async (tx) => {
    if (payload.categoryId && payload.categoryId !== course.categoryId) {
      const newCategory = await tx.category.findUnique({
        where: { id: payload.categoryId },
      });
      if (!newCategory) {
        throw new ApiError(httpStatus.NOT_FOUND, 'New category not found');
      }

      await tx.category.update({
        where: { id: course.categoryId },
        data: { courseCount: { decrement: 1 } },
      });

      await tx.category.update({
        where: { id: payload.categoryId },
        data: { courseCount: { increment: 1 } },
      });
    }

    const updatedCourse = await tx.course.update({
      where: { id },
      data: payload,
      include: {
        category: true,
        instructorProfile: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
      },
    });

    return updatedCourse;
  });

  await clearCourseCache();

  return result;
};

const deleteCourse = async (userPayload: TAccessTokenPayload, id: string): Promise<Course> => {
  const course = await prisma.course.findUnique({
    where: { id },
    include: { instructorProfile: true },
  });

  if (!course || course.isDeleted) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Course not found');
  }

  if (userPayload.role === UserRoleEnum.INSTRUCTOR) {
    if (course.instructorProfile.userId !== userPayload.userId) {
      throw new ApiError(httpStatus.FORBIDDEN, 'You can only delete your own courses');
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const deleted = await tx.course.update({
      where: { id },
      data: { isDeleted: true },
    });

    await tx.category.update({
      where: { id: course.categoryId },
      data: { courseCount: { decrement: 1 } },
    });

    return deleted;
  });

  await clearCourseCache();

  return result;
};

export const CourseServices = {
  createCourse,
  getAllCourses,
  getSingleCourse,
  updateCourse,
  deleteCourse,
};
