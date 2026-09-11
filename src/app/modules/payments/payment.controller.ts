import type { Request, Response } from 'express';
import httpStatus from 'http-status';

import { PaymentServices } from './payment.service';
import catchAsync from '../../helpers/catchAsync';
import sendResponse from '../../utils/sendResponse';

const sslSuccessCallback = catchAsync(async (req: Request, res: Response) => {
  const tranId = (req.query.tran_id as string) || req.body?.tran_id;
  const valId = (req.query.val_id as string) || req.body?.val_id;

  const redirectUrl = await PaymentServices.handleSuccess(tranId, valId, req.body);
  res.redirect(redirectUrl);
});

const sslFailCallback = catchAsync(async (req: Request, res: Response) => {
  const tranId = (req.query.tran_id as string) || req.body?.tran_id;

  const redirectUrl = await PaymentServices.handleFail(tranId, req.body);
  res.redirect(redirectUrl);
});

const sslCancelCallback = catchAsync(async (req: Request, res: Response) => {
  const tranId = (req.query.tran_id as string) || req.body?.tran_id;

  const redirectUrl = await PaymentServices.handleCancel(tranId, req.body);
  res.redirect(redirectUrl);
});

const sslIPNCallback = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentServices.handleIPN(req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'IPN Received',
    data: result,
  });
});

const getPaymentReceipt = catchAsync(async (req: Request, res: Response) => {
  const { transactionId } = req.params;
  const result = await PaymentServices.getPaymentByTransactionId(transactionId, req.user.userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Payment receipt fetched successfully',
    data: result,
  });
});

const getMyPaymentHistory = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentServices.getMyPaymentHistory(req.user.userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Payment history fetched successfully',
    data: result,
  });
});

export const PaymentControllers = {
  sslSuccessCallback,
  sslFailCallback,
  sslCancelCallback,
  sslIPNCallback,
  getPaymentReceipt,
  getMyPaymentHistory,
};
