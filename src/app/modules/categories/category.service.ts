import type { Category, Prisma } from '@prisma/client';
import httpStatus from 'http-status';

import type {
  ICategoryFilterRequest,
  ICreateCategory,
  IUpdateCategory,
} from './category.interface';
import ApiError from '../../errors/ApiError';
import { paginationHelper } from '../../helpers/paginationHelper';
import type { IPaginationOptions } from '../../interface/pagination.type';
import prisma from '../../libs/prisma';
import { redis } from '../../libs/redis';
import { slugify } from '../../utils/stringUtils';

const clearCategoryCache = async () => {
  try {
    const keys = await redis.keys('categories:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    console.error('Redis clear category cache error:', error);
  }
};

const createCategory = async (payload: ICreateCategory): Promise<Category> => {
  const slug = slugify(payload.title);

  const existingCategory = await prisma.category.findFirst({
    where: {
      OR: [{ title: payload.title }, { slug }],
    },
  });

  if (existingCategory) {
    throw new ApiError(httpStatus.CONFLICT, 'Category with this title or slug already exists');
  }

  const result = await prisma.category.create({
    data: {
      title: payload.title,
      slug,
      image: payload.image,
    },
  });

  await clearCategoryCache();

  return result;
};

const getAllCategories = async (filters: ICategoryFilterRequest, options: IPaginationOptions) => {
  const cacheKey = `categories:all:${JSON.stringify(filters)}:${JSON.stringify(options)}`;

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

  const andConditions: Prisma.CategoryWhereInput[] = [];

  if (searchTerm) {
    andConditions.push({
      OR: [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { slug: { contains: searchTerm, mode: 'insensitive' } },
      ],
    });
  }

  if (Object.keys(filterData).length > 0) {
    andConditions.push({
      AND: Object.keys(filterData).map((key) => {
        if (key === 'isDeleted') {
          return {
            [key]:
              filterData[key as keyof typeof filterData] === 'true' ||
              filterData[key as keyof typeof filterData] === true,
          };
        }
        return {
          [key]: filterData[key as keyof typeof filterData],
        };
      }),
    });
  }

  const whereConditions: Prisma.CategoryWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const result = await prisma.category.findMany({
    where: whereConditions,
    skip,
    take: limit,
    orderBy: {
      [sortBy]: sortOrder,
    },
    include: {
      _count: {
        select: {
          courses: {
            where: { isDeleted: false },
          },
        },
      },
    },
  });

  const total = await prisma.category.count({
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
    await redis.set(cacheKey, JSON.stringify(response), 'EX', 5 * 24 * 60 * 60); // Cache for 5 days
  } catch (error) {
    console.error('Redis write error:', error);
  }

  return response;
};

const getSingleCategory = async (idOrSlug: string): Promise<Category> => {
  const cacheKey = `categories:single:${idOrSlug}`;

  try {
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }
  } catch (error) {
    console.error('Redis read error:', error);
  }

  const result = await prisma.category.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
    },
    include: {
      courses: {
        where: { isDeleted: false, isPublished: true },
        take: 10,
      },
      _count: {
        select: { courses: { where: { isDeleted: false } } },
      },
    },
  });

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Category not found');
  }

  try {
    await redis.set(cacheKey, JSON.stringify(result), 'EX', 5 * 24 * 60 * 60); // Cache for 5 days
  } catch (error) {
    console.error('Redis write error:', error);
  }

  return result;
};

const updateCategory = async (id: string, payload: IUpdateCategory): Promise<Category> => {
  const category = await prisma.category.findUnique({
    where: { id },
  });

  if (!category) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Category not found');
  }

  const updateData: Prisma.CategoryUpdateInput = { ...payload };

  if (payload.title && payload.title !== category.title) {
    const newSlug = slugify(payload.title);
    const existingSlug = await prisma.category.findFirst({
      where: {
        slug: newSlug,
        NOT: { id },
      },
    });

    if (existingSlug) {
      throw new ApiError(httpStatus.CONFLICT, 'Category title produces duplicate slug');
    }

    updateData.title = payload.title;
    updateData.slug = newSlug;
  }

  const result = await prisma.category.update({
    where: { id },
    data: updateData,
  });

  await clearCategoryCache();

  return result;
};

const deleteCategory = async (id: string): Promise<Category> => {
  const category = await prisma.category.findUnique({
    where: { id },
  });

  if (!category) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Category not found');
  }

  const result = await prisma.category.update({
    where: { id },
    data: {
      isDeleted: true,
    },
  });

  await clearCategoryCache();

  return result;
};

export const CategoryServices = {
  createCategory,
  getAllCategories,
  getSingleCategory,
  updateCategory,
  deleteCategory,
};
