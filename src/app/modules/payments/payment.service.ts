import { EnrollmentStatusEnum, PaymentStatusEnum } from '@prisma/client';
import httpStatus from 'http-status';

import { SSLCommerzServices } from './sslcommerz.service';
import ApiError from '../../errors/ApiError';
import prisma from '../../libs/prisma';
import config from '../../../configs';

const handleSuccess = async (tranId: string, valId?: string, rawBody?: any) => {
  const payment = await prisma.payment.findUnique({
    where: { transactionId: tranId },
    include: { course: true, student: true },
  });

  if (!payment) {
    throw new ApiError(httpStatus.NOT_FOUND, `Payment not found for transaction ${tranId}`);
  }

  // Idempotency: If already marked as SUCCESS, just redirect
  if (payment.status === PaymentStatusEnum.SUCCESS) {
    return `${config.urls.frontend_url}/payment/success?tran_id=${tranId}&course_id=${payment.courseId}`;
  }

  const effectiveValId = valId || rawBody?.val_id;
  if (!effectiveValId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Validation ID (val_id) is missing');
  }

  // 1. Security Check: Validate directly with SSLCommerz server
  const valResponse = await SSLCommerzServices.validatePayment(effectiveValId);

  const isValidStatus = valResponse.status === 'VALID' || valResponse.status === 'VALIDATED';

  if (!isValidStatus || valResponse.tran_id !== tranId) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatusEnum.FAILED,
        gatewayResponse: valResponse as any,
      },
    });
    return `${config.urls.frontend_url}/payment/failed?tran_id=${tranId}&error=tampering_detected`;
  }

  // 2. Anti-tampering check: Verify paid amount matches course amount in database
  const validatedAmount = Number(valResponse.currency_amount || valResponse.amount);
  const expectedAmount = Number(payment.amount);

  if (Math.abs(validatedAmount - expectedAmount) > 0.5) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatusEnum.FAILED,
        gatewayResponse: valResponse as any,
      },
    });
    return `${config.urls.frontend_url}/payment/failed?tran_id=${tranId}&error=amount_mismatch`;
  }

  // 3. Database ACID Transaction: Activate Enrollment & Mark Payment as SUCCESS
  await prisma.$transaction(async (tx: any) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatusEnum.SUCCESS,
        valId: effectiveValId,
        bankTranId: valResponse.bank_tran_id || rawBody?.bank_tran_id,
        cardType: valResponse.card_type || rawBody?.card_type,
        cardBrand: valResponse.card_brand || rawBody?.card_brand,
        cardIssuer: valResponse.card_issuer || rawBody?.card_issuer,
        gatewayResponse: valResponse as any,
        paidAt: new Date(),
      },
    });

    await tx.enrollment.upsert({
      where: {
        studentId_courseId: {
          studentId: payment.studentId,
          courseId: payment.courseId,
        },
      },
      update: {
        status: EnrollmentStatusEnum.ACTIVE,
        paymentId: payment.id,
        enrolledAt: new Date(),
      },
      create: {
        studentId: payment.studentId,
        courseId: payment.courseId,
        status: EnrollmentStatusEnum.ACTIVE,
        paymentId: payment.id,
        enrolledAt: new Date(),
      },
    });

    await tx.course.update({
      where: { id: payment.courseId },
      data: {
        totalStudents: { increment: 1 },
      },
    });
  });

  return `${config.urls.frontend_url}/payment/success?tran_id=${tranId}&course_id=${payment.courseId}`;
};

const handleFail = async (tranId: string, rawBody?: any) => {
  const payment = await prisma.payment.findUnique({
    where: { transactionId: tranId },
  });

  if (payment && payment.status === PaymentStatusEnum.PENDING) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatusEnum.FAILED,
        gatewayResponse: rawBody || {},
      },
    });
  }

  return `${config.urls.frontend_url}/payment/failed?tran_id=${tranId}`;
};

const handleCancel = async (tranId: string, rawBody?: any) => {
  const payment = await prisma.payment.findUnique({
    where: { transactionId: tranId },
  });

  if (payment && payment.status === PaymentStatusEnum.PENDING) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatusEnum.CANCELLED,
        gatewayResponse: rawBody || {},
      },
    });
  }

  return `${config.urls.frontend_url}/payment/cancelled?tran_id=${tranId}`;
};

const handleIPN = async (body: any) => {
  const tranId = body?.tran_id;
  const valId = body?.val_id;

  if (!tranId || !valId) {
    return { success: false, message: 'Invalid IPN payload' };
  }

  const payment = await prisma.payment.findUnique({
    where: { transactionId: tranId },
  });

  if (!payment) {
    return { success: false, message: 'Payment record not found' };
  }

  if (payment.status === PaymentStatusEnum.SUCCESS) {
    return { success: true, message: 'Already processed' };
  }

  if (body.status === 'VALID' || body.status === 'VALIDATED') {
    await handleSuccess(tranId, valId, body);
    return { success: true, message: 'IPN processed successfully' };
  }

  if (body.status === 'FAILED') {
    await handleFail(tranId, body);
    return { success: true, message: 'IPN failed recorded' };
  }

  if (body.status === 'CANCELLED') {
    await handleCancel(tranId, body);
    return { success: true, message: 'IPN cancellation recorded' };
  }

  return { success: true, message: 'Unhandled IPN status' };
};

const getPaymentByTransactionId = async (transactionId: string, userId: string) => {
  const payment = await prisma.payment.findUnique({
    where: { transactionId },
    include: {
      course: {
        select: {
          id: true,
          title: true,
          slug: true,
          image: true,
          price: true,
        },
      },
      enrollment: true,
    },
  });

  if (!payment) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Payment not found');
  }

  if (payment.studentId !== userId) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You are not authorized to view this receipt');
  }

  return payment;
};

const getMyPaymentHistory = async (userId: string) => {
  return prisma.payment.findMany({
    where: { studentId: userId },
    include: {
      course: {
        select: {
          id: true,
          title: true,
          slug: true,
          image: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
};

export const PaymentServices = {
  handleSuccess,
  handleFail,
  handleCancel,
  handleIPN,
  getPaymentByTransactionId,
  getMyPaymentHistory,
};
