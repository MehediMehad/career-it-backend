import type { Prisma } from '@prisma/client';
import { UserRoleEnum, UserStatusEnum } from '@prisma/client';
import { hash } from 'bcrypt';

import prisma from './prisma';
import config from '../../configs';
import { generateCustomId } from '../utils/customId';

const seedSuperAdmin = async () => {
  try {
    const isSuperAdminExists = await prisma.user.findFirst({
      where: {
        role: UserRoleEnum.ADMIN,
      },
    });

    if (isSuperAdminExists) {
      console.log('✅  Super Admin already exists.');
      return;
    }
    const hashedPassword = await hash(config.admin.password, config.jwt.bcrypt_salt_rounds);
    const customId = await generateCustomId(UserRoleEnum.ADMIN);
    const superAdminData: Prisma.UserCreateInput = {
      name: 'Super Admin',
      image: '00000000',
      customId,
      password: hashedPassword,
      email: config.admin.email,
      role: UserRoleEnum.ADMIN,
      status: UserStatusEnum.ACTIVE,
      isVerified: true,
    };

    await prisma.user.create({
      data: superAdminData,
    });

    console.log('✅ Super Admin created successfully.');
  } catch (error) {
    console.error('❌ Error seeding Super Admin:', error);
  }
};

export default seedSuperAdmin;
