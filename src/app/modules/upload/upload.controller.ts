import type { Request, Response } from 'express';
import httpStatus from 'http-status';

import { UploadServices } from './upload.service';
import catchAsync from '../../helpers/catchAsync';
import sendResponse from '../../utils/sendResponse';

const initiateUpload = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const result = await UploadServices.initiateUpload(userId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Multipart upload session initiated successfully',
    data: result,
  });
});

const getPresignedUrls = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const result = await UploadServices.getPresignedUrls(userId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Presigned URLs generated successfully',
    data: result,
  });
});

const completeUpload = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const result = await UploadServices.completeUpload(userId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Multipart upload completed successfully',
    data: result,
  });
});

const abortUpload = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const result = await UploadServices.abortUpload(userId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Multipart upload aborted successfully',
    data: result,
  });
});

const getUploadStatus = catchAsync(async (req: Request, res: Response) => {
  const { uploadId } = req.params;
  const result = await UploadServices.getUploadStatus(uploadId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Upload status retrieved successfully',
    data: result,
  });
});

export const UploadControllers = {
  initiateUpload,
  getPresignedUrls,
  completeUpload,
  abortUpload,
  getUploadStatus,
};
