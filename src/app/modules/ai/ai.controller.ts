import type { Request, Response } from 'express';
import httpStatus from 'http-status';

import * as AIService from './ai.service';
import catchAsync from '../../helpers/catchAsync';
import sendResponse from '../../utils/sendResponse';

const chatWithCounselor = catchAsync(async (req: Request, res: Response) => {
  const { messages } = req.body;
  const result = await AIService.chatWithCounselor(messages);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'AI response generated successfully',
    data: result,
  });
});

const syncKnowledge = catchAsync(async (_req: Request, res: Response) => {
  const result = await AIService.syncCourseKnowledge();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Knowledge base synced successfully',
    data: result,
  });
});

export const AIController = {
  chatWithCounselor,
  syncKnowledge,
};

