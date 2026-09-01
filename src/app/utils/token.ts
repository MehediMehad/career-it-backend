import type { UserRoleEnum } from '@prisma/client';
import type { Secret, SignOptions } from 'jsonwebtoken';
import jwt from 'jsonwebtoken';

import config from '../../configs';

export interface ITokenPayload {
  userId: string;
  customId: string;
  email: string;
  role: UserRoleEnum;
  deviceId?: string;
}

export const createToken = (
  payload: Record<string, unknown>,
  secret: Secret,
  expireIn: string,
): string => {
  const options: SignOptions = {
    algorithm: 'HS256',
    expiresIn: expireIn as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, secret, options);
};

export const verifyToken = <T>(token: string, secret: Secret): T => jwt.verify(token, secret) as T;

export const generateAuthTokens = (payload: ITokenPayload) => {
  const accessToken = createToken(
    payload as unknown as Record<string, unknown>,
    config.jwt.access_secret,
    config.jwt.access_expires_in,
  );

  const refreshToken = createToken(
    payload as unknown as Record<string, unknown>,
    config.jwt.refresh_secret,
    config.jwt.refresh_expires_in,
  );

  return {
    accessToken,
    refreshToken,
  };
};
