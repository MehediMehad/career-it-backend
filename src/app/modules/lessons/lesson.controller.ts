import type { Request, Response } from 'express';
import httpStatus from 'http-status';

import { lessonFilterableFields } from './lesson.constant';
import { LessonServices } from './lesson.service';
import catchAsync from '../../helpers/catchAsync';
import pick from '../../helpers/pick';
import sendResponse from '../../utils/sendResponse';

const createLesson = catchAsync(async (req: Request, res: Response) => {
  const result = await LessonServices.createLesson(req.user, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Lesson created successfully',
    data: result,
  });
});

const getAllLessonsByModule = catchAsync(async (req: Request, res: Response) => {
  const { moduleId } = req.params;
  const filters = pick(req.query, lessonFilterableFields);
  const options = pick(req.query, ['limit', 'page', 'sortBy', 'sortOrder']);

  const result = await LessonServices.getAllLessonsByModule(moduleId, filters, options);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Lessons fetched successfully',
    meta: result.meta,
    data: result.data,
  });
});

const getSingleLesson = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await LessonServices.getSingleLesson(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Lesson details fetched successfully',
    data: result,
  });
});

const updateLesson = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await LessonServices.updateLesson(req.user, id, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Lesson updated successfully',
    data: result,
  });
});

const deleteLesson = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await LessonServices.deleteLesson(req.user, id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Lesson deleted successfully',
    data: result,
  });
});

const getLessonPlayback = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user; // populated if auth middleware was used or optional
  const result = await LessonServices.getLessonPlayback(user, id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Lesson playback URL generated successfully',
    data: result,
  });
});

const reorderLessons = catchAsync(async (req: Request, res: Response) => {
  const result = await LessonServices.reorderLessons(req.user, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Lessons reordered successfully',
    data: result,
  });
});

export const LessonControllers = {
  createLesson,
  getAllLessonsByModule,
  getSingleLesson,
  updateLesson,
  deleteLesson,
  getLessonPlayback,
  reorderLessons,
};

