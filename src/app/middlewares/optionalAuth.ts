import type { NextFunction, Request, Response } from 'express';
import { UserStatusEnum } from '@prisma/client';
import type { JwtPayload } from 'jsonwebtoken';

import config from '../../configs';
import type { TAccessTokenPayload } from '../interface';
import prisma from '../libs/prisma';
import { redis } from '../libs/redis';
import { verifyToken } from '../utils/token';

export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return next();
    }

    const isBlacklisted = await redis.get(`blacklist:${token}`);
    if (isBlacklisted) {
      return next();
    }

    const verifiedUser = verifyToken<JwtPayload & TAccessTokenPayload>(
      token,
      config.jwt.access_secret,
    );

    if (!verifiedUser || !verifiedUser.userId || !verifiedUser.email) {
      return next();
    }

    const user = await prisma.user.findUnique({
      where: {
        id: verifiedUser.userId,
      },
    });

    if (
      !user ||
      user.status === UserStatusEnum.BLOCKED ||
      user.status === UserStatusEnum.DEACTIVATE
    ) {
      return next();
    }

    req.user = {
      ...verifiedUser,
      role: user.role,
    };

    next();
  } catch {
    // On token expiration, signature mismatch, or any error, continue as guest/unauthenticated
    next();
  }
};

export default optionalAuth;

