import type { Request, Response } from 'express';
import httpStatus from 'http-status';

import { StudentProfileServices } from './student-profile.service';
import catchAsync from '../../helpers/catchAsync';
import pick from '../../helpers/pick';
import sendResponse from '../../utils/sendResponse';

const upsertMyProfile = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const result = await StudentProfileServices.upsertMyProfile(userId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Student profile updated successfully',
    data: result,
  });
});

const getMyProfile = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const result = await StudentProfileServices.getMyProfile(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Student profile fetched successfully',
    data: result,
  });
});

const getAllStudentProfiles = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(req.query, ['searchTerm', 'gender', 'institution']);
  const options = pick(req.query, ['limit', 'page', 'sortBy', 'sortOrder']);

  const result = await StudentProfileServices.getAllStudentProfiles(filters, options);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Student profiles fetched successfully',
    meta: result.meta,
    data: result.data,
  });
});

const getSingleStudentProfile = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await StudentProfileServices.getSingleStudentProfile(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Student profile fetched successfully',
    data: result,
  });
});

const updateStudentProfile = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await StudentProfileServices.updateStudentProfile(id, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Student profile updated successfully',
    data: result,
  });
});

export const StudentProfileControllers = {
  upsertMyProfile,
  getMyProfile,
  getAllStudentProfiles,
  getSingleStudentProfile,
  updateStudentProfile,
};
