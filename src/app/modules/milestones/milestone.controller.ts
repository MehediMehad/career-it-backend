import type { Request, Response } from 'express';
import httpStatus from 'http-status';

import { MilestoneServices } from './milestone.service';
import catchAsync from '../../helpers/catchAsync';
import pick from '../../helpers/pick';
import sendResponse from '../../utils/sendResponse';

const createMilestone = catchAsync(async (req: Request, res: Response) => {
  const result = await MilestoneServices.createMilestone(req.user, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Milestone created successfully',
    data: result,
  });
});

const getAllMilestones = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(req.query, ['searchTerm', 'courseId']);
  const options = pick(req.query, ['limit', 'page', 'sortBy', 'sortOrder']);

  const result = await MilestoneServices.getAllMilestones(filters, options);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Milestones fetched successfully',
    meta: result.meta,
    data: result.data,
  });
});

const getSingleMilestone = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await MilestoneServices.getSingleMilestone(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Milestone fetched successfully',
    data: result,
  });
});

const updateMilestone = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await MilestoneServices.updateMilestone(req.user, id, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Milestone updated successfully',
    data: result,
  });
});

const deleteMilestone = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await MilestoneServices.deleteMilestone(req.user, id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Milestone deleted successfully',
    data: result,
  });
});

export const MilestoneControllers = {
  createMilestone,
  getAllMilestones,
  getSingleMilestone,
  updateMilestone,
  deleteMilestone,
};
