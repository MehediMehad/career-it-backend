import type { UserRoleEnum } from '@prisma/client';

import prisma from '../libs/prisma';
import { redis } from '../libs/redis';

export const generateCustomId = async (role: UserRoleEnum): Promise<string> => {
  const prefix = role ? role.toUpperCase() : 'STUDENT';
  const redisKey = `seq:custom_id:${prefix}`;

  const exists = await redis.exists(redisKey);
  if (!exists) {
    const lastUser = await prisma.user.findFirst({
      where: { role },
      orderBy: { createdAt: 'desc' },
      select: { customId: true },
    });

    let currentNumber = 0;
    if (lastUser?.customId) {
      const parts = lastUser.customId.split('-');
      const lastNum = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastNum)) currentNumber = lastNum;
    }
    // set up the Redis custom sequence
    await redis.set(redisKey, currentNumber);
  }

  // 2. Redis Atomic Increment
  const nextSeq = await redis.incr(redisKey);
  const formattedSeq = nextSeq.toString().padStart(4, '0');

  return `${prefix}-${formattedSeq}`;
};
