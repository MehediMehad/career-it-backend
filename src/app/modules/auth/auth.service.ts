import crypto from 'crypto';

import type { User, Device } from '@prisma/client';
import { UserRoleEnum, UserStatusEnum } from '@prisma/client';
import { compare, hash } from 'bcrypt';
import httpStatus from 'http-status';

import type {
  TRegisterPayload,
  TLoginPayload,
  TConfirmPendingLoginPayload,
  TChangePasswordPayload,
  TForgotPasswordPayload,
  TResetPasswordPayload,
  TVerifyPayload,
  TResendOtpPayload,
} from './auth.interface';
import config from '../../../configs';
import ApiError from '../../errors/ApiError';
import prisma from '../../libs/prisma';
import { redis } from '../../libs/redis';
import { queueEmail } from '../../queues/email.queue';
import { queueNotification } from '../../queues/notification.queue';
import { generateCustomId } from '../../utils/customId';
import type { IDeviceInfo } from '../../utils/device';
import { ForgotPasswordHtml } from '../../utils/email/ForgotPasswordHtml';
import { SignUpVerificationHtml } from '../../utils/email/SignUpVerificationHtml';
import { generateAuthTokens, verifyToken, type ITokenPayload } from '../../utils/token';

const sanitizeUser = (user: User) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...userWithoutPassword } = user;
  return userWithoutPassword;
};

const registerUser = async (payload: TRegisterPayload, deviceInfo: IDeviceInfo) => {
  const existingUser = await prisma.user.findUnique({
    where: { email: payload.email },
  });

  if (existingUser) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User already exists with this email');
  }

  const hashedPassword = await hash(payload.password, config.jwt.bcrypt_salt_rounds);
  const role = payload.role || UserRoleEnum.STUDENT;
  const customId = await generateCustomId(role);

  const user = await prisma.user.create({
    data: {
      name: payload.name,
      customId,
      email: payload.email,
      password: hashedPassword,
      role,
      image: payload.image || '',
      status: UserStatusEnum.DEACTIVATE,
      isVerified: false,
      devices: {
        create: {
          deviceId: deviceInfo.deviceId,
          deviceName: deviceInfo.deviceName,
          deviceType: deviceInfo.deviceType,
          browser: deviceInfo.browser,
          os: deviceInfo.os,
          ipAddress: deviceInfo.ipAddress,
          fcmToken: deviceInfo.fcmToken || null,
          isActive: true,
        },
      },
    },
  });

  // Generate 6-digit OTP code
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  await redis.set(`otp:verify:${user.email}`, otpCode, 'EX', 300); // 5 minutes TTL

  // Queue Verification Email
  await queueEmail({
    to: user.email,
    subject: 'Email Verification OTP',
    html: SignUpVerificationHtml(otpCode, user.name),
  });

  return {
    data: sanitizeUser(user),
    message: 'Registration successful! Please check your email for verification OTP.',
  };
};

const loginUser = async (payload: TLoginPayload, deviceInfo: IDeviceInfo) => {
  const user = await prisma.user.findUnique({
    where: { email: payload.email },
  });

  if (!user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid email or password');
  }

  const isPasswordMatch = await compare(payload.password, user.password);
  if (!isPasswordMatch) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid email or password');
  }

  if (user.status === UserStatusEnum.BLOCKED) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Your account is blocked. Contact support.');
  }

  if (!user.isVerified) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      'Email is not verified. Please verify your account first.',
    );
  }

  // Get active devices for user
  const activeDevices = await prisma.device.findMany({
    where: {
      userId: user.id,
      isActive: true,
    },
    orderBy: {
      lastActiveAt: 'asc',
    },
  });

  const existingDevice = activeDevices.find((d) => d.deviceId === deviceInfo.deviceId);

  if (existingDevice) {
    // Device already registered and active -> Update metadata & login
    const updatedDevice = await prisma.device.update({
      where: { id: existingDevice.id },
      data: {
        deviceName: deviceInfo.deviceName,
        deviceType: deviceInfo.deviceType,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        ipAddress: deviceInfo.ipAddress,
        fcmToken: deviceInfo.fcmToken || existingDevice.fcmToken,
        lastActiveAt: new Date(),
        isActive: true,
      },
    });

    await redis.del(`user:devices:${user.id}`);

    const tokens = generateAuthTokens({
      userId: user.id,
      customId: user.customId,
      email: user.email,
      role: user.role,
      deviceId: updatedDevice.deviceId,
    });

    // Notify user of new login via BullMQ
    await queueNotification({
      type: 'SINGLE',
      receiverId: user.id,
      title: 'Security Alert: New Login',
      body: `Login detected on ${deviceInfo.deviceName} (${deviceInfo.ipAddress})`,
      notificationType: 'SECURITY',
    });

    return {
      tokens,
      user: sanitizeUser(user),
      device: updatedDevice,
    };
  }

  // If new device, check 5-device limit
  if (activeDevices.length >= 5) {
    const pendingToken = crypto.randomUUID();
    const pendingData = {
      userId: user.id,
      deviceInfo,
      createdAt: new Date().toISOString(),
    };

    // Save pending login in Redis for 5 mins (300s)
    await redis.set(`pending-login:${pendingToken}`, JSON.stringify(pendingData), 'EX', 300);

    return {
      code: 'DEVICE_LIMIT_REACHED',
      message: 'Maximum device limit reached (5 devices). Select a device to log out.',
      pendingToken,
      devices: activeDevices.map((d) => ({
        id: d.id,
        deviceId: d.deviceId,
        deviceName: d.deviceName,
        browser: d.browser,
        os: d.os,
        lastActiveAt: d.lastActiveAt,
      })),
    };
  }

  // Less than 5 devices -> Execute transaction to prevent race conditions
  const newDevice = await prisma.$transaction(async (tx) => {
    const currentActiveCount = await tx.device.count({
      where: { userId: user.id, isActive: true },
    });

    if (currentActiveCount >= 5) {
      throw new ApiError(
        httpStatus.CONFLICT,
        'Maximum 5 devices limit reached. Simultaneous login conflict.',
      );
    }

    return tx.device.upsert({
      where: {
        userId_deviceId: {
          userId: user.id,
          deviceId: deviceInfo.deviceId,
        },
      },
      update: {
        deviceName: deviceInfo.deviceName,
        deviceType: deviceInfo.deviceType,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        ipAddress: deviceInfo.ipAddress,
        fcmToken: deviceInfo.fcmToken || null,
        isActive: true,
        lastActiveAt: new Date(),
      },
      create: {
        userId: user.id,
        deviceId: deviceInfo.deviceId,
        deviceName: deviceInfo.deviceName,
        deviceType: deviceInfo.deviceType,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        ipAddress: deviceInfo.ipAddress,
        fcmToken: deviceInfo.fcmToken || null,
        isActive: true,
      },
    });
  });

  await redis.del(`user:devices:${user.id}`);

  // Send security push notification to existing devices
  await queueNotification({
    type: 'SINGLE',
    receiverId: user.id,
    title: 'Security Alert: New Device Logged In',
    body: `A new device ${deviceInfo.deviceName} signed into your account from ${deviceInfo.ipAddress}`,
    notificationType: 'SECURITY',
  });

  const tokens = generateAuthTokens({
    userId: user.id,
    customId: user.customId,
    email: user.email,
    role: user.role,
    deviceId: newDevice.deviceId,
  });

  return {
    tokens,
    user: sanitizeUser(user),
    device: newDevice,
  };
};

const confirmPendingLogin = async (
  payload: TConfirmPendingLoginPayload,
  currentDeviceInfo: IDeviceInfo,
) => {
  const pendingRaw = await redis.get(`pending-login:${payload.pendingToken}`);
  if (!pendingRaw) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Pending login request has expired or is invalid. Please login again.',
    );
  }

  const pendingData: { userId: string; deviceInfo: IDeviceInfo } = JSON.parse(pendingRaw);
  const { userId, deviceInfo } = pendingData;

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const effectiveDeviceInfo = {
    ...deviceInfo,
    ...currentDeviceInfo,
    deviceId: deviceInfo.deviceId || currentDeviceInfo.deviceId,
  };

  // Transaction: Deactivate chosen device & Activate/create new device
  const newDevice = await prisma.$transaction(async (tx) => {
    // 1. Deactivate target device
    await tx.device.updateMany({
      where: {
        userId,
        OR: [{ id: payload.logoutDeviceId }, { deviceId: payload.logoutDeviceId }],
      },
      data: {
        isActive: false,
        fcmToken: null,
      },
    });

    // 2. Activate or create new device
    return tx.device.upsert({
      where: {
        userId_deviceId: {
          userId,
          deviceId: effectiveDeviceInfo.deviceId,
        },
      },
      update: {
        deviceName: effectiveDeviceInfo.deviceName,
        deviceType: effectiveDeviceInfo.deviceType,
        browser: effectiveDeviceInfo.browser,
        os: effectiveDeviceInfo.os,
        ipAddress: effectiveDeviceInfo.ipAddress,
        fcmToken: effectiveDeviceInfo.fcmToken || null,
        isActive: true,
        lastActiveAt: new Date(),
      },
      create: {
        userId,
        deviceId: effectiveDeviceInfo.deviceId,
        deviceName: effectiveDeviceInfo.deviceName,
        deviceType: effectiveDeviceInfo.deviceType,
        browser: effectiveDeviceInfo.browser,
        os: effectiveDeviceInfo.os,
        ipAddress: effectiveDeviceInfo.ipAddress,
        fcmToken: effectiveDeviceInfo.fcmToken || null,
        isActive: true,
      },
    });
  });

  // Cleanup pending token in Redis
  await redis.del(`pending-login:${payload.pendingToken}`);
  await redis.del(`user:devices:${userId}`);

  // Send security notification
  await queueNotification({
    type: 'SINGLE',
    receiverId: user.id,
    title: 'Security Alert: Device Revoked & Logged In',
    body: `Device ${effectiveDeviceInfo.deviceName} was activated after revoking a previous device session.`,
    notificationType: 'SECURITY',
  });

  const tokens = generateAuthTokens({
    userId: user.id,
    customId: user.customId,
    email: user.email,
    role: user.role,
    deviceId: newDevice.deviceId,
  });

  return {
    tokens,
    user: sanitizeUser(user),
    device: newDevice,
  };
};

const getUserDevices = async (userId: string, currentDeviceId?: string) => {
  const cacheKey = `user:devices:${userId}`;
  const cached = await redis.get(cacheKey);

  let devices: Device[] = [];

  if (cached) {
    devices = JSON.parse(cached);
  } else {
    devices = await prisma.device.findMany({
      where: {
        userId,
        isActive: true,
      },
      orderBy: {
        lastActiveAt: 'desc',
      },
    });
    await redis.set(cacheKey, JSON.stringify(devices), 'EX', 600); // 10 mins cache
  }

  return devices.map((d) => ({
    ...d,
    currentDevice: Boolean(currentDeviceId && d.deviceId === currentDeviceId),
  }));
};

const logoutDevice = async (userId: string, targetDeviceId: string) => {
  await prisma.device.updateMany({
    where: {
      userId,
      OR: [{ id: targetDeviceId }, { deviceId: targetDeviceId }],
    },
    data: {
      isActive: false,
      fcmToken: null,
    },
  });

  await redis.del(`user:devices:${userId}`);

  return { message: 'Device session logged out successfully' };
};

const logout = async (token: string, userId?: string, deviceId?: string) => {
  // Blacklist access token in Redis (24 hour TTL)
  await redis.set(`blacklist:${token}`, 'true', 'EX', 86400);

  if (userId && deviceId) {
    await prisma.device.updateMany({
      where: {
        userId,
        deviceId,
      },
      data: {
        isActive: false,
        fcmToken: null,
      },
    });
    await redis.del(`user:devices:${userId}`);
  }

  return { message: 'Logged out successfully' };
};

const logoutAll = async (userId: string, token: string) => {
  await redis.set(`blacklist:${token}`, 'true', 'EX', 86400);

  await prisma.device.updateMany({
    where: { userId },
    data: {
      isActive: false,
      fcmToken: null,
    },
  });

  await redis.del(`user:devices:${userId}`);

  return { message: 'Logged out from all devices successfully' };
};

const verifyEmail = async (payload: TVerifyPayload) => {
  const otpCode = await redis.get(`otp:verify:${payload.email}`);

  if (!otpCode || otpCode !== payload.code) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid or expired OTP code');
  }

  const user = await prisma.user.findUnique({
    where: { email: payload.email },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const updatedUser = await prisma.user.update({
    where: { email: payload.email },
    data: {
      isVerified: true,
      status: UserStatusEnum.ACTIVE,
    },
  });

  await redis.del(`otp:verify:${payload.email}`);

  return {
    message: 'Email verified successfully! You can now login.',
    result: sanitizeUser(updatedUser),
  };
};

const forgotPassword = async (payload: TForgotPasswordPayload) => {
  const user = await prisma.user.findUnique({
    where: { email: payload.email },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User with this email does not exist');
  }

  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  await redis.set(`otp:reset-pass:${user.email}`, otpCode, 'EX', 300); // 5 mins TTL

  await queueEmail({
    to: user.email,
    subject: 'Password Reset OTP',
    html: ForgotPasswordHtml(otpCode, user.name),
  });

  return { message: 'Password reset OTP sent to your email' };
};

const resetPassword = async (payload: TResetPasswordPayload) => {
  const otpCode = await redis.get(`otp:reset-pass:${payload.email}`);

  if (!otpCode || otpCode !== payload.code) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid or expired OTP code');
  }

  const user = await prisma.user.findUnique({
    where: { email: payload.email },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const hashedPassword = await hash(payload.newPassword, config.jwt.bcrypt_salt_rounds);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
    },
  });

  await redis.del(`otp:reset-pass:${payload.email}`);

  return { message: 'Password reset successfully' };
};

const changePassword = async (userId: string, payload: TChangePasswordPayload) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const isMatch = await compare(payload.oldPassword, user.password);
  if (!isMatch) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Current password does not match');
  }

  const hashedPassword = await hash(payload.newPassword, config.jwt.bcrypt_salt_rounds);

  await prisma.user.update({
    where: { id: userId },
    data: {
      password: hashedPassword,
    },
  });

  return { message: 'Password changed successfully' };
};

const getMe = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      devices: {
        where: { isActive: true },
        orderBy: { lastActiveAt: 'desc' },
      },
    },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  return sanitizeUser(user as User);
};

const refreshToken = async (refreshTokenStr: string) => {
  const verifiedToken = verifyToken<ITokenPayload>(refreshTokenStr, config.jwt.refresh_secret);

  if (!verifiedToken || !verifiedToken.userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid refresh token');
  }

  const user = await prisma.user.findUnique({
    where: { id: verifiedToken.userId },
  });

  if (!user || user.status === UserStatusEnum.BLOCKED) {
    throw new ApiError(httpStatus.FORBIDDEN, 'User account is restricted');
  }

  const tokens = generateAuthTokens({
    userId: user.id,
    customId: user.customId,
    email: user.email,
    role: user.role,
    deviceId: verifiedToken.deviceId,
  });

  return tokens;
};

const resendOtp = async (payload: TResendOtpPayload) => {
  const user = await prisma.user.findUnique({
    where: { email: payload.email },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const redisKey =
    payload.type === 'FORGOT_PASSWORD' || payload.type === 'RESET_PASSWORD'
      ? `otp:reset-pass:${payload.email}`
      : `otp:verify:${payload.email}`;

  await redis.set(redisKey, otpCode, 'EX', 300);

  const html =
    payload.type === 'FORGOT_PASSWORD' || payload.type === 'RESET_PASSWORD'
      ? ForgotPasswordHtml(otpCode, user.name)
      : SignUpVerificationHtml(otpCode, user.name);

  await queueEmail({
    to: user.email,
    subject: `OTP Resend - ${payload.type}`,
    html,
  });

  return { message: 'OTP resent successfully to your email' };
};

export const AuthServices = {
  registerUser,
  loginUser,
  confirmPendingLogin,
  getUserDevices,
  logoutDevice,
  logout,
  logoutAll,
  verifyEmail,
  forgotPassword,
  resetPassword,
  changePassword,
  getMe,
  refreshToken,
  resendOtp,
};
