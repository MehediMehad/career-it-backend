import { UserRoleEnum } from '@prisma/client';
import type { Request, Response } from 'express';
import httpStatus from 'http-status';

import { InstructorProfileServices } from './instructor-profile.service';
import catchAsync from '../../helpers/catchAsync';
import pick from '../../helpers/pick';
import sendResponse from '../../utils/sendResponse';

const upsertMyProfile = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const result = await InstructorProfileServices.upsertMyProfile(userId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Instructor profile updated successfully',
    data: result,
  });
});

const getMyProfile = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const result = await InstructorProfileServices.getMyProfile(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Instructor profile fetched successfully',
    data: result,
  });
});

const getAllInstructorProfiles = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(req.query, ['searchTerm', 'adminApproved']);
  const options = pick(req.query, ['limit', 'page', 'sortBy', 'sortOrder']);
  const isAdmin = req.user?.role === UserRoleEnum.ADMIN;

  const result = await InstructorProfileServices.getAllInstructorProfiles(
    filters,
    options,
    isAdmin,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Instructor profiles fetched successfully',
    meta: result.meta,
    data: result.data,
  });
});

const getSingleInstructorProfile = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await InstructorProfileServices.getSingleInstructorProfile(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Instructor profile fetched successfully',
    data: result,
  });
});

const updateInstructorProfile = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await InstructorProfileServices.updateInstructorProfile(id, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Instructor profile updated successfully',
    data: result,
  });
});

const updateAdminApprovalStatus = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { adminApproved } = req.body;
  const result = await InstructorProfileServices.updateAdminApprovalStatus(id, adminApproved);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Instructor approval status updated successfully',
    data: result,
  });
});

export const InstructorProfileControllers = {
  upsertMyProfile,
  getMyProfile,
  getAllInstructorProfiles,
  getSingleInstructorProfile,
  updateInstructorProfile,
  updateAdminApprovalStatus,
};
