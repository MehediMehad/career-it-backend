import type { Request, Response } from 'express';
import httpStatus from 'http-status';

import { ModuleServices } from './module.service';
import catchAsync from '../../helpers/catchAsync';
import pick from '../../helpers/pick';
import sendResponse from '../../utils/sendResponse';

const createModule = catchAsync(async (req: Request, res: Response) => {
  const result = await ModuleServices.createModule(req.user, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Module created successfully',
    data: result,
  });
});

const getAllModules = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(req.query, ['searchTerm', 'courseId', 'milestoneId']);
  const options = pick(req.query, ['limit', 'page', 'sortBy', 'sortOrder']);

  const result = await ModuleServices.getAllModules(filters, options);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Modules fetched successfully',
    meta: result.meta,
    data: result.data,
  });
});

const getSingleModule = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await ModuleServices.getSingleModule(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Module fetched successfully',
    data: result,
  });
});

const updateModule = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await ModuleServices.updateModule(req.user, id, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Module updated successfully',
    data: result,
  });
});

const deleteModule = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await ModuleServices.deleteModule(req.user, id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Module deleted successfully',
    data: result,
  });
});

export const ModuleControllers = {
  createModule,
  getAllModules,
  getSingleModule,
  updateModule,
  deleteModule,
};
