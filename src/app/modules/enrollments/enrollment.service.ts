import { EnrollmentStatusEnum, PaymentStatusEnum } from '@prisma/client';
import httpStatus from 'http-status';

import ApiError from '../../errors/ApiError';
import prisma from '../../libs/prisma';
import { SSLCommerzServices } from '../payments/sslcommerz.service';

const checkoutCourse = async (userId: string, courseId: string) => {
  const [user, course] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true },
    }),
    prisma.course.findUnique({
      where: { id: courseId },
    }),
  ]);

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Student account not found');
  }

  if (!course || !course.isPublished || course.isDeleted) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Course is not available for enrollment');
  }

  // Check if student is already actively enrolled
  const existingEnrollment = await prisma.enrollment.findUnique({
    where: {
      studentId_courseId: {
        studentId: userId,
        courseId,
      },
    },
  });

  if (existingEnrollment && existingEnrollment.status === EnrollmentStatusEnum.ACTIVE) {
    throw new ApiError(httpStatus.CONFLICT, 'You are already enrolled in this course');
  }

  const coursePrice = Number(course.price);

  // Case 1: Free Course Enrollment (Instant Access)
  if (coursePrice === 0) {
    await prisma.$transaction(async (tx: any) => {
      await tx.enrollment.upsert({
        where: {
          studentId_courseId: {
            studentId: userId,
            courseId,
          },
        },
        update: {
          status: EnrollmentStatusEnum.ACTIVE,
          enrolledAt: new Date(),
        },
        create: {
          studentId: userId,
          courseId,
          status: EnrollmentStatusEnum.ACTIVE,
          enrolledAt: new Date(),
        },
      });

      await tx.course.update({
        where: { id: courseId },
        data: {
          totalStudents: { increment: 1 },
        },
      });
    });

    return {
      isFree: true,
      enrolled: true,
      message: 'Successfully enrolled in this free course',
    };
  }

  // Case 2: Paid Course Enrollment via SSLCommerz
  const transactionId = `TRAN-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

  await prisma.payment.create({
    data: {
      transactionId,
      studentId: userId,
      courseId,
      amount: course.price,
      currency: 'BDT',
      status: PaymentStatusEnum.PENDING,
      gateway: 'SSLCOMMERZ',
    },
  });

  const paymentUrl = await SSLCommerzServices.initiateSession({
    transactionId,
    amount: coursePrice,
    courseTitle: course.title,
    studentName: user.name,
    studentEmail: user.email,
    studentPhone: user.studentProfile?.phoneNumber,
  });

  return {
    isFree: false,
    enrolled: false,
    transactionId,
    paymentUrl,
  };
};

const getMyEnrollments = async (userId: string) => {
  return prisma.enrollment.findMany({
    where: {
      studentId: userId,
      status: EnrollmentStatusEnum.ACTIVE,
    },
    include: {
      course: {
        include: {
          category: {
            select: { id: true, title: true, slug: true },
          },
          instructorProfile: {
            include: {
              user: {
                select: { name: true, image: true },
              },
            },
          },
        },
      },
      payment: {
        select: {
          transactionId: true,
          amount: true,
          paidAt: true,
          cardType: true,
        },
      },
    },
    orderBy: { enrolledAt: 'desc' },
  });
};

const checkEnrollmentStatus = async (userId: string, courseId: string) => {
  const enrollment = await prisma.enrollment.findUnique({
    where: {
      studentId_courseId: {
        studentId: userId,
        courseId,
      },
    },
  });

  return {
    isEnrolled: enrollment?.status === EnrollmentStatusEnum.ACTIVE,
    status: enrollment?.status || null,
    enrolledAt: enrollment?.enrolledAt || null,
    progress: enrollment ? Number(enrollment.progress) : 0,
  };
};

const updateProgress = async (userId: string, courseId: string, progressPercentage: number) => {
  const enrollment = await prisma.enrollment.findUnique({
    where: {
      studentId_courseId: {
        studentId: userId,
        courseId,
      },
    },
  });

  if (!enrollment || enrollment.status !== EnrollmentStatusEnum.ACTIVE) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You are not enrolled in this course');
  }

  const boundedProgress = Math.min(100, Math.max(0, progressPercentage));
  const isCompleted = boundedProgress === 100;

  return prisma.enrollment.update({
    where: { id: enrollment.id },
    data: {
      progress: boundedProgress,
      status: isCompleted ? EnrollmentStatusEnum.COMPLETED : EnrollmentStatusEnum.ACTIVE,
      completedAt: isCompleted ? new Date() : enrollment.completedAt,
    },
  });
};

export const EnrollmentServices = {
  checkoutCourse,
  getMyEnrollments,
  checkEnrollmentStatus,
  updateProgress,
};
