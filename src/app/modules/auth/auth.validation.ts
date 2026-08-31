import { UserRoleEnum, DeviceType } from '@prisma/client';
import { z } from 'zod';

export enum OtpTypeEnum {
  LOGIN = 'LOGIN',
  FORGOT_PASSWORD = 'FORGOT_PASSWORD',
  VERIFY_EMAIL = 'VERIFY_EMAIL',
  RESET_PASSWORD = 'RESET_PASSWORD',
  VERIFY_PHONE = 'VERIFY_PHONE',
  VERIFY_USER = 'VERIFY_USER',
}

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(32, 'Password must be at most 32 characters long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[@$!%*?&#]/, 'Password must contain at least one special character');

export const registerSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be at most 50 characters'),
  image: z.string().url('Image must be a valid URL').optional(),
  email: z.string().email('Invalid email address').trim().toLowerCase(),
  password: passwordSchema,
  role: z.nativeEnum(UserRoleEnum).default(UserRoleEnum.STUDENT),
  deviceId: z.string().optional(),
  deviceName: z.string().optional(),
  deviceType: z.nativeEnum(DeviceType).optional(),
  fcmToken: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address').trim().toLowerCase(),
  password: z.string().min(6, 'Password is required'),
  deviceId: z.string().optional(),
  deviceName: z.string().optional(),
  deviceType: z.nativeEnum(DeviceType).optional(),
  fcmToken: z.string().optional(),
});

export const confirmPendingLoginSchema = z.object({
  pendingToken: z.string().min(1, 'pendingToken is required'),
  logoutDeviceId: z.string().min(1, 'logoutDeviceId is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address').trim().toLowerCase(),
});

export const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email address').trim().toLowerCase(),
  code: z.string().length(6, 'OTP must be 6 digits'),
  newPassword: passwordSchema,
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(6, 'Old password is required'),
  newPassword: passwordSchema,
});

export const verifySchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  code: z.string().length(6, 'OTP must be 6 digits'),
  type: z.nativeEnum(OtpTypeEnum).default(OtpTypeEnum.VERIFY_EMAIL),
});

export const resendOtpSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  type: z.nativeEnum(OtpTypeEnum),
});

export const AuthsValidations = {
  registerSchema,
  loginSchema,
  confirmPendingLoginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  verifySchema,
  resendOtpSchema,
};
