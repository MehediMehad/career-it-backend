---
name: realtime-socket
description: Implement real-time communication using Socket.IO with Redis adapter for notifications, chat, and live updates across clustered server instances.
---

# Real-Time Socket.IO & Redis Adapter Skill

## Purpose

Implement scalable real-time events, instant notifications, and live status synchronization using Socket.IO with the Redis adapter (`@socket.io/redis-adapter`) for multi-process and horizontal scalability.

---

## 1. Socket Architecture Overview

```text
Client Browser / Mobile
        │ (WebSocket / Polling)
        ▼
   Express Server (Socket.IO)
        │
   Redis Pub/Sub Adapter (ioredis)
        │
   Clustered Express Workers / Servers
```

---

## 2. Authentication on Handshake

Always verify JWT on connection before accepting socket handshake:

```typescript
import jwt from 'jsonwebtoken';
import config from '../../configs';

io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
  if (!token) {
    return next(new Error('Authentication token missing'));
  }

  try {
    const bearer = token.startsWith('Bearer ') ? token.slice(7) : token;
    const verified = jwt.verify(bearer, config.jwt.secret as string);
    socket.data.user = verified;
    next();
  } catch (err) {
    next(new Error('Authentication failed'));
  }
});
```

---

## 3. Room Management Standards

- **User Private Room**: Join users to their own room upon connection:
  `socket.join(`user:${user.id}`)`
- **Role Broadcast Room**: Join users based on role:
  `socket.join(`role:${user.role}`)`
- **Course/Batch Room**: Join enrolled students to live updates:
  `socket.join(`course:${courseId}`)`

---

## 4. Emitting Targeted Events

- Direct to specific user:
  ```typescript
  io.to(`user:${userId}`).emit('notification:new', notificationData);
  ```
- Broadcast to all admins:
  ```typescript
  io.to('role:ADMIN').emit('admin:alert', alertData);
  ```
