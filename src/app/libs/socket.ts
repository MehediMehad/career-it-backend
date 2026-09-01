import type { Server as HttpServer } from 'http';

import { UserRoleEnum, UserStatusEnum } from '@prisma/client';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { Server as SocketServer } from 'socket.io';

import prisma from './prisma';
import config from '../../configs';
import { verifyToken, type ITokenPayload } from '../utils/token';

// Extend Socket.io Socket to include user info
declare module 'socket.io' {
  interface Socket {
    user?: {
      userId: string;
      email: string;
      role: UserRoleEnum;
    };
  }
}

export function initializeSocket(httpServer: HttpServer) {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: config.app.cors_origins || '*',
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Redis adapter for scaling (reuse existing Redis configuration)
  const hasRedis = config.redis.host && config.redis.port;
  if (hasRedis) {
    try {
      const pubClient = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password || undefined,
        maxRetriesPerRequest: null,
      });
      const subClient = pubClient.duplicate();

      io.adapter(createAdapter(pubClient, subClient));
      console.log('✅ Socket.io Redis adapter connected');
    } catch (error) {
      console.error('⚠️ Socket.io Redis adapter failed, running without adapter', error);
    }
  }

  // Authentication middleware — validate JWT on connection
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization;

      if (!token) {
        return next(new Error('Authentication token missing'));
      }

      // Remove "Bearer " prefix if present
      const cleanToken = token.replace('Bearer ', '');

      const decoded = verifyToken<ITokenPayload>(cleanToken, config.jwt.access_secret);

      // Look up the user from the database
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true, role: true, status: true },
      });

      if (!user) {
        return next(new Error('User not found'));
      }

      if (user.status === UserStatusEnum.BLOCKED) {
        return next(new Error('Your account is blocked!'));
      }

      if (user.status === UserStatusEnum.DEACTIVATE) {
        return next(new Error('Your account is not Activate!'));
      }

      // Attach user info to socket
      socket.user = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };

      next();
    } catch {
      next(new Error('Invalid authentication token'));
    }
  });

  // Connection handling
  io.on('connection', (socket) => {
    const user = socket.user!;
    console.log(`✅ Socket connected: ${user.email} (${user.role})`);

    // Join user-specific room (by user ID)
    socket.join(`user:${user.userId}`);

    // Join role-specific room (lowercase, e.g. role:user, role:admin, role:moderator)
    socket.join(`role:${user.role.toLowerCase()}`);

    // Join admin room for both ADMIN and MODERATOR
    if (user.role === UserRoleEnum.ADMIN) {
      socket.join('role:admin');
    }

    // Broadcast online status to admins
    io.to('role:admin').emit('user:online', {
      userId: user.userId,
      email: user.email,
      role: user.role,
      timestamp: new Date().toISOString(),
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`❌ Socket disconnected: ${user.email} (${reason})`);

      io.to('role:admin').emit('user:offline', {
        userId: user.userId,
        email: user.email,
        role: user.role,
        timestamp: new Date().toISOString(),
        reason,
      });
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });

  return io;
}

export type SocketIOServer = ReturnType<typeof initializeSocket>;

declare global {
  var io: SocketIOServer | undefined;
}
