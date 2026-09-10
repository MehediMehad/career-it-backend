import type { Lesson, Prisma } from '@prisma/client';
import { LessonTypeEnum, UserRoleEnum, VideoProviderEnum } from '@prisma/client';
import httpStatus from 'http-status';

import { lessonSearchableFields } from './lesson.constant';
import type {
  ICreateLesson,
  ILessonFilterRequest,
  ILessonPlaybackResponse,
  IReorderLessonsPayload,
  IUpdateLesson,
} from './lesson.interface';
import ApiError from '../../errors/ApiError';
import { paginationHelper } from '../../helpers/paginationHelper';
import { s3MultipartHelper } from '../../helpers/s3Multipart';
import type { TAccessTokenPayload } from '../../interface';
import type { IPaginationOptions } from '../../interface/pagination.type';
import prisma from '../../libs/prisma';
import { redis } from '../../libs/redis';

// Helper to clear lesson and playback caches
const clearLessonCache = async (moduleId?: string, courseId?: string, lessonId?: string) => {
  try {
    const keysToDelete: string[] = [];

    if (lessonId) {
      const playbackKeys = await redis.keys(`playback:lesson:${lessonId}:*`);
      keysToDelete.push(...playbackKeys);
    }

    if (moduleId) {
      const moduleLessonKeys = await redis.keys(`lessons:module:${moduleId}:*`);
      keysToDelete.push(...moduleLessonKeys);
    }

    const generalKeys = await redis.keys('lessons:*');
    keysToDelete.push(...generalKeys);

    const moduleKeys = await redis.keys('modules:*');
    keysToDelete.push(...moduleKeys);

    const milestoneKeys = await redis.keys('milestones:*');
    keysToDelete.push(...milestoneKeys);

    const courseKeys = await redis.keys('courses:*');
    keysToDelete.push(...courseKeys);

    if (keysToDelete.length > 0) {
      const uniqueKeys = [...new Set(keysToDelete)];
      await redis.del(...uniqueKeys);
    }
  } catch (error) {
    console.error('Redis clear lesson cache error:', error);
  }
};

/**
 * Check if a student is actively enrolled in a course.
 * Uses Redis caching for instant validation and falls back to DB if enrollment model exists.
 */
const checkStudentEnrollment = async (userId: string, courseId: string): Promise<boolean> => {
  const cacheKey = `enrollment:${courseId}:${userId}`;

  try {
    const cachedStatus = await redis.get(cacheKey);
    if (cachedStatus !== null) {
      return cachedStatus === 'true';
    }
  } catch (err) {
    console.warn('Redis enrollment cache get error:', err);
  }

  let isEnrolled = false;

  type ExtendedPrisma = typeof prisma & {
    courseEnrollment?: {
      findFirst: (args: { where: { studentId: string; courseId: string } }) => Promise<unknown>;
    };
  };

  const dynamicPrisma = prisma as ExtendedPrisma;
  if (dynamicPrisma.courseEnrollment) {
    const enrollment = await dynamicPrisma.courseEnrollment.findFirst({
      where: {
        studentId: userId,
        courseId,
      },
    });
    isEnrolled = Boolean(enrollment);
  } else {
    // If enrollment model is pending migration, permit registered user for now
    isEnrolled = true;
  }

  // Cache enrollment status in Redis for 1 hour (3600s)
  try {
    await redis.set(cacheKey, isEnrolled ? 'true' : 'false', 'EX', 3600);
  } catch (err) {
    console.warn('Redis enrollment cache set error:', err);
  }

  return isEnrolled;
};

/**
 * Create a new lesson inside a module
 */
const createLesson = async (
  userPayload: TAccessTokenPayload,
  payload: ICreateLesson,
): Promise<Lesson> => {
  // 1. Verify module and parent course
  const moduleRecord = await prisma.module.findUnique({
    where: { id: payload.moduleId },
    include: {
      course: {
        include: {
          instructorProfile: true,
        },
      },
    },
  });

  if (!moduleRecord) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Module not found');
  }

  // 2. Ownership Authorization Check
  if (userPayload.role === UserRoleEnum.INSTRUCTOR) {
    if (moduleRecord.course.instructorProfile?.userId !== userPayload.userId) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        'Forbidden: You can only add lessons to your own course',
      );
    }
  }

  // 3. Check for unique lessonNumber within this module
  const existingLessonNumber = await prisma.lesson.findUnique({
    where: {
      moduleId_lessonNumber: {
        moduleId: payload.moduleId,
        lessonNumber: payload.lessonNumber,
      },
    },
  });

  if (existingLessonNumber) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Lesson number ${payload.lessonNumber} already exists in this module`,
    );
  }

  // 4. Atomic creation and count increment via Prisma Transaction
  const createdLesson = await prisma.$transaction(async (tx) => {
    const lesson = await tx.lesson.create({
      data: {
        lessonNumber: payload.lessonNumber,
        title: payload.title,
        lessonType: payload.lessonType,
        videoProvider: payload.videoProvider || VideoProviderEnum.S3,
        videoKey: payload.videoKey || null,
        videoUrl: payload.videoUrl || null,
        duration: payload.duration || null,
        isFreePreview: payload.isFreePreview ?? false,
        moduleId: payload.moduleId,
      },
    });

    // Increment module's lessonsCount
    await tx.module.update({
      where: { id: payload.moduleId },
      data: {
        lessonsCount: { increment: 1 },
      },
    });

    // Increment course's totalLessons
    await tx.course.update({
      where: { id: moduleRecord.courseId },
      data: {
        totalLessons: { increment: 1 },
      },
    });

    return lesson;
  });

  // 5. Invalidate caches
  await clearLessonCache(payload.moduleId, moduleRecord.courseId);

  return createdLesson;
};

/**
 * Get all lessons for a specific module with pagination & filters
 */
const getAllLessonsByModule = async (
  moduleId: string,
  filters: ILessonFilterRequest,
  options: IPaginationOptions,
) => {
  const { limit, page, skip, sortBy, sortOrder } = paginationHelper.calculatePagination(options);
  const { searchTerm, ...filterData } = filters;

  const andConditions: Prisma.LessonWhereInput[] = [{ moduleId }];

  if (searchTerm) {
    andConditions.push({
      OR: lessonSearchableFields.map((field) => ({
        [field]: {
          contains: searchTerm,
          mode: 'insensitive',
        },
      })),
    });
  }

  if (Object.keys(filterData).length > 0) {
    const filterConditions: Prisma.LessonWhereInput = {};
    if (filterData.lessonType) {
      filterConditions.lessonType = filterData.lessonType;
    }
    if (filterData.isFreePreview !== undefined) {
      filterConditions.isFreePreview =
        filterData.isFreePreview === true || filterData.isFreePreview === 'true';
    }
    andConditions.push(filterConditions);
  }

  const whereConditions: Prisma.LessonWhereInput = { AND: andConditions };

  const [data, total] = await Promise.all([
    prisma.lesson.findMany({
      where: whereConditions,
      skip,
      take: limit,
      orderBy: sortBy && sortOrder ? { [sortBy]: sortOrder } : { lessonNumber: 'asc' },
    }),
    prisma.lesson.count({ where: whereConditions }),
  ]);

  const totalPage = Math.ceil(total / limit);

  return {
    meta: {
      page,
      limit,
      total,
      totalPage,
    },
    data,
  };
};

/**
 * Get a single lesson by ID
 */
const getSingleLesson = async (id: string): Promise<Lesson> => {
  const lesson = await prisma.lesson.findUnique({
    where: { id },
    include: {
      module: {
        select: {
          id: true,
          title: true,
          moduleNumber: true,
          courseId: true,
        },
      },
    },
  });

  if (!lesson) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Lesson not found');
  }

  return lesson;
};

/**
 * Update lesson details
 */
const updateLesson = async (
  userPayload: TAccessTokenPayload,
  id: string,
  payload: IUpdateLesson,
): Promise<Lesson> => {
  const existingLesson = await prisma.lesson.findUnique({
    where: { id },
    include: {
      module: {
        include: {
          course: {
            include: { instructorProfile: true },
          },
        },
      },
    },
  });

  if (!existingLesson) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Lesson not found');
  }

  // Ownership Authorization Check
  if (userPayload.role === UserRoleEnum.INSTRUCTOR) {
    if (existingLesson.module.course.instructorProfile?.userId !== userPayload.userId) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        'Forbidden: You can only update lessons for your own course',
      );
    }
  }

  // Check lessonNumber uniqueness if updated
  if (payload.lessonNumber && payload.lessonNumber !== existingLesson.lessonNumber) {
    const duplicateNumber = await prisma.lesson.findUnique({
      where: {
        moduleId_lessonNumber: {
          moduleId: existingLesson.moduleId,
          lessonNumber: payload.lessonNumber,
        },
      },
    });

    if (duplicateNumber) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Lesson number ${payload.lessonNumber} already exists in this module`,
      );
    }
  }

  // Clean up old S3 video if a new videoKey is being assigned
  if (payload.videoKey && existingLesson.videoKey && payload.videoKey !== existingLesson.videoKey) {
    await s3MultipartHelper.deleteObject(existingLesson.videoKey);
  }

  const updatedLesson = await prisma.lesson.update({
    where: { id },
    data: payload,
  });

  // Invalidate Redis caches
  await clearLessonCache(existingLesson.moduleId, existingLesson.module.courseId, id);

  return updatedLesson;
};

/**
 * Delete a lesson and decrement counts atomically
 */
const deleteLesson = async (userPayload: TAccessTokenPayload, id: string): Promise<Lesson> => {
  const existingLesson = await prisma.lesson.findUnique({
    where: { id },
    include: {
      module: {
        include: {
          course: {
            include: { instructorProfile: true },
          },
        },
      },
    },
  });

  if (!existingLesson) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Lesson not found');
  }

  // Ownership Authorization Check
  if (userPayload.role === UserRoleEnum.INSTRUCTOR) {
    if (existingLesson.module.course.instructorProfile?.userId !== userPayload.userId) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        'Forbidden: You can only delete lessons from your own course',
      );
    }
  }

  // Atomic deletion and count decrement
  const deletedLesson = await prisma.$transaction(async (tx) => {
    const deleted = await tx.lesson.delete({
      where: { id },
    });

    await tx.module.update({
      where: { id: existingLesson.moduleId },
      data: {
        lessonsCount: { decrement: 1 },
      },
    });

    await tx.course.update({
      where: { id: existingLesson.module.courseId },
      data: {
        totalLessons: { decrement: 1 },
      },
    });

    return deleted;
  });

  // Clean up S3 video object if present
  if (existingLesson.videoKey) {
    await s3MultipartHelper.deleteObject(existingLesson.videoKey);
  }

  // Invalidate Redis caches
  await clearLessonCache(existingLesson.moduleId, existingLesson.module.courseId, id);

  return deletedLesson;
};

/**
 * Secure Video Playback with Redis Cache-Aside & Time-Limited Presigned GET URL
 */
const getLessonPlayback = async (
  userPayload: TAccessTokenPayload | undefined,
  lessonId: string,
): Promise<ILessonPlaybackResponse> => {
  const userId = userPayload?.userId || 'guest';
  const cacheKey = `playback:lesson:${lessonId}:user:${userId}`;

  // 1. Check Redis Cache-Aside
  try {
    const cachedPlayback = await redis.get(cacheKey);
    if (cachedPlayback) {
      return JSON.parse(cachedPlayback);
    }
  } catch (err) {
    console.warn('Redis playback cache lookup error:', err);
  }

  // 2. Fetch lesson and parent course
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      module: {
        include: {
          course: {
            include: { instructorProfile: true },
          },
        },
      },
    },
  });

  if (!lesson) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Lesson not found');
  }

  if (lesson.lessonType !== LessonTypeEnum.VIDEO) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'This lesson is not a video lesson');
  }

  // 3. Permission & Enrollment Verification
  if (!lesson.isFreePreview) {
    // If not a free preview, user authentication is strictly required
    if (!userPayload) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Authentication required to access this lesson');
    }

    const isAdmin = userPayload.role === UserRoleEnum.ADMIN;
    const isCourseInstructor =
      userPayload.role === UserRoleEnum.INSTRUCTOR &&
      lesson.module.course.instructorProfile?.userId === userPayload.userId;

    if (!isAdmin && !isCourseInstructor) {
      // Must be an actively enrolled student
      const isEnrolled = await checkStudentEnrollment(userPayload.userId, lesson.module.courseId);
      if (!isEnrolled) {
        throw new ApiError(
          httpStatus.FORBIDDEN,
          'Forbidden: You must be enrolled in this course to watch this lesson',
        );
      }
    }
  }

  // 4. Generate Playback Response
  let responseData: ILessonPlaybackResponse;

  if (lesson.videoProvider === VideoProviderEnum.S3 && lesson.videoKey) {
    // 10 minutes (600s) presigned GET URL for direct S3 private object access
    const expiresIn = 600;
    const playbackUrl = await s3MultipartHelper.generatePresignedGetUrl(lesson.videoKey, expiresIn);
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    responseData = {
      type: VideoProviderEnum.S3,
      playbackUrl,
      expiresIn,
      expiresAt,
    };

    // Cache in Redis for 500 seconds (so cache expires slightly before S3 signed URL expires)
    try {
      await redis.set(cacheKey, JSON.stringify(responseData), 'EX', 500);
    } catch (err) {
      console.warn('Redis playback cache save error:', err);
    }
  } else if (lesson.videoUrl) {
    // External video provider (e.g. YouTube, Vimeo)
    responseData = {
      type: lesson.videoProvider || VideoProviderEnum.EXTERNAL,
      playbackUrl: lesson.videoUrl,
    };
  } else {
    throw new ApiError(httpStatus.NOT_FOUND, 'Video source not available for this lesson');
  }

  return responseData;
};

const reorderLessons = async (
  userPayload: TAccessTokenPayload,
  payload: IReorderLessonsPayload,
): Promise<{ success: boolean; count: number }> => {
  const { moduleId, items } = payload;

  const moduleItem = await prisma.module.findUnique({
    where: { id: moduleId },
    include: { course: { include: { instructorProfile: true } } },
  });

  if (!moduleItem) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Module not found');
  }

  if (userPayload.role === UserRoleEnum.INSTRUCTOR) {
    if (moduleItem.course.instructorProfile.userId !== userPayload.userId) {
      throw new ApiError(httpStatus.FORBIDDEN, 'You can only reorder lessons in your own module');
    }
  }

  await prisma.$transaction(async (tx) => {
    // Phase 1: Set temporary negative lessonNumbers to prevent @@unique([moduleId, lessonNumber]) collision
    for (let i = 0; i < items.length; i++) {
      await tx.lesson.update({
        where: { id: items[i].id },
        data: { lessonNumber: -(i + 1) },
      });
    }

    // Phase 2: Set final target lesson numbers
    for (const item of items) {
      await tx.lesson.update({
        where: { id: item.id },
        data: { lessonNumber: item.lessonNumber },
      });
    }
  });

  await clearLessonCache(moduleId, moduleItem.courseId);

  return { success: true, count: items.length };
};

export const LessonServices = {
  createLesson,
  getAllLessonsByModule,
  getSingleLesson,
  updateLesson,
  deleteLesson,
  getLessonPlayback,
  reorderLessons,
};
