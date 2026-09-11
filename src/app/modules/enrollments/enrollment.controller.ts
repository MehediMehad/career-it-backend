import type { Request, Response } from 'express';
import httpStatus from 'http-status';

import { EnrollmentServices } from './enrollment.service';
import catchAsync from '../../helpers/catchAsync';
import sendResponse from '../../utils/sendResponse';

const checkoutCourse = catchAsync(async (req: Request, res: Response) => {
  const { courseId } = req.body;
  const result = await EnrollmentServices.checkoutCourse(req.user.userId, courseId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.isFree ? result.message : 'Payment session initialized',
    data: result,
  });
});

const getMyEnrollments = catchAsync(async (req: Request, res: Response) => {
  const result = await EnrollmentServices.getMyEnrollments(req.user.userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Enrolled courses fetched successfully',
    data: result,
  });
});

const checkEnrollmentStatus = catchAsync(async (req: Request, res: Response) => {
  const { courseId } = req.params;
  const result = await EnrollmentServices.checkEnrollmentStatus(req.user.userId, courseId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Enrollment status fetched successfully',
    data: result,
  });
});

const updateProgress = catchAsync(async (req: Request, res: Response) => {
  const { courseId } = req.params;
  const { progress } = req.body;
  const result = await EnrollmentServices.updateProgress(
    req.user.userId,
    courseId,
    Number(progress),
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Course progress updated successfully',
    data: result,
  });
});

export const EnrollmentControllers = {
  checkoutCourse,
  getMyEnrollments,
  checkEnrollmentStatus,
  updateProgress,
};
