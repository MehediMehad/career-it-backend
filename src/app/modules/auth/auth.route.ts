import { Router } from 'express';

import { AuthControllers } from './auth.controller';
import { AuthsValidations } from './auth.validation';
import auth from '../../middlewares/auth';
import {
  forgotPasswordLimiter,
  loginLimiter,
  resendOtpLimiter,
} from '../../middlewares/rateLimiter';
import validateRequest from '../../middlewares/validateRequest';

const router = Router();

router.post(
  '/register',
  validateRequest(AuthsValidations.registerSchema),
  AuthControllers.registerUserIntoDB,
);

router.post(
  '/login',
  loginLimiter,
  validateRequest(AuthsValidations.loginSchema),
  AuthControllers.loginUserIntoDB,
);

router.post(
  '/device-login/confirm',
  validateRequest(AuthsValidations.confirmPendingLoginSchema),
  AuthControllers.confirmPendingLogin,
);

router.post(
  '/confirm-pending-login',
  validateRequest(AuthsValidations.confirmPendingLoginSchema),
  AuthControllers.confirmPendingLogin,
);

router.get('/devices', auth('STUDENT', 'INSTRUCTOR' ,'ADMIN'), AuthControllers.getUserDevices);

router.delete('/devices/:deviceId', auth('STUDENT', 'INSTRUCTOR' ,'ADMIN'), AuthControllers.logoutDevice);

router.post('/logout', auth('STUDENT', 'INSTRUCTOR' ,'ADMIN'), AuthControllers.logoutUser);

router.post('/logout-all', auth('STUDENT', 'INSTRUCTOR' ,'ADMIN'), AuthControllers.logoutAllDevices);

router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  validateRequest(AuthsValidations.forgotPasswordSchema),
  AuthControllers.forgotPasswordIntoDB,
);

router.post(
  '/reset-password',
  validateRequest(AuthsValidations.resetPasswordSchema),
  AuthControllers.resetPasswordIntoDB,
);

router.post(
  '/change-password',
  auth('STUDENT', 'INSTRUCTOR' ,'ADMIN'),
  validateRequest(AuthsValidations.changePasswordSchema),
  AuthControllers.changePasswordIntoDB,
);

router.post(
  '/verify',
  validateRequest(AuthsValidations.verifySchema),
  AuthControllers.verifyEmailIntoDB,
);

router.post(
  '/resend-otp',
  resendOtpLimiter,
  validateRequest(AuthsValidations.resendOtpSchema),
  AuthControllers.resendOtpIntoDB,
);

router.post('/refresh-token', AuthControllers.refreshTokenIntoDB);

router.get('/me', auth('STUDENT', 'INSTRUCTOR' ,'ADMIN'), AuthControllers.getMyProfile);

export const AuthRoute = router;
