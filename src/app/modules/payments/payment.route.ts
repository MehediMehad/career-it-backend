import { UserRoleEnum } from '@prisma/client';
import express from 'express';

import { PaymentControllers } from './payment.controller';
import auth from '../../middlewares/auth';

const router = express.Router();

// SSLCommerz Callbacks & Webhooks (Public POST endpoints)
router.post('/sslcommerz/success', PaymentControllers.sslSuccessCallback);
router.post('/sslcommerz/fail', PaymentControllers.sslFailCallback);
router.post('/sslcommerz/cancel', PaymentControllers.sslCancelCallback);
router.post('/sslcommerz/ipn', PaymentControllers.sslIPNCallback);

// Authenticated Student Endpoints
router.get(
  '/history',
  auth(UserRoleEnum.STUDENT, UserRoleEnum.ADMIN),
  PaymentControllers.getMyPaymentHistory,
);

router.get(
  '/receipt/:transactionId',
  auth(UserRoleEnum.STUDENT, UserRoleEnum.ADMIN),
  PaymentControllers.getPaymentReceipt,
);

export const PaymentRoutes = router;
