import type { Request, Response } from 'express';
import httpStatus from 'http-status';

import { CourseServices } from './course.service';
import catchAsync from '../../helpers/catchAsync';
import pick from '../../helpers/pick';
import sendResponse from '../../utils/sendResponse';

const createCourse = catchAsync(async (req: Request, res: Response) => {
  const result = await CourseServices.createCourse(req.user, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Course created successfully',
    data: result,
  });
});

const getAllCourses = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(req.query, [
    'searchTerm',
    'categoryId',
    'instructorProfileId',
    'level',
    'isPublished',
    'isFeatured',
    'isDeleted',
    'minPrice',
    'maxPrice',
  ]);
  const options = pick(req.query, ['limit', 'page', 'sortBy', 'sortOrder']);
  const userRole = req.user?.role;

  const result = await CourseServices.getAllCourses(filters, options, userRole);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Courses fetched successfully',
    meta: result.meta,
    data: result.data,
  });
});

const getSingleCourse = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await CourseServices.getSingleCourse(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Course fetched successfully',
    data: result,
  });
});

const updateCourse = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await CourseServices.updateCourse(req.user, id, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Course updated successfully',
    data: result,
  });
});

const deleteCourse = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await CourseServices.deleteCourse(req.user, id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Course deleted successfully',
    data: result,
  });
});

export const CourseControllers = {
  createCourse,
  getAllCourses,
  getSingleCourse,
  updateCourse,
  deleteCourse,
};
