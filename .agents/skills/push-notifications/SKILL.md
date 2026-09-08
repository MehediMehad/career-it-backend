---
name: push-notifications
description: Send FCM push notifications, manage device registration tokens, handle invalid tokens, and dispatch notifications asynchronously via BullMQ.
---

# Push Notifications & Firebase Cloud Messaging (FCM) Skill

## Purpose

Manage device registration tokens and dispatch reliable push notifications to students and instructors via Firebase Cloud Messaging (FCM) in `career-it-backend`.

---

## 1. Firebase Admin Initialization

Use the shared Firebase Admin and FCM client from `src/app/libs/firebaseAdmin.ts`:

```typescript
import { fcm } from '../../libs/firebaseAdmin';
import prisma from '../../libs/prisma';
```

---

## 2. Device Token Lifecycle (`device.prisma`)

Device registration tokens must be saved when users log in or enable notifications:

- A user can have multiple devices (e.g. mobile phone, tablet, browser).
- Model reference: `Device` with fields `userId`, `fcmToken`, `deviceType`, `lastActiveAt`.

### Register or Refresh Device Token

```typescript
const registerDeviceToken = async (userId: string, fcmToken: string, deviceType = 'WEB') => {
  return prisma.device.upsert({
    where: { fcmToken },
    update: {
      userId,
      deviceType,
      updatedAt: new Date(),
    },
    create: {
      userId,
      fcmToken,
      deviceType,
    },
  });
};
```

---

## 3. Sending Push Notifications

### Single User Notification

```typescript
import { fcm } from '../../libs/firebaseAdmin';
import prisma from '../../libs/prisma';

const sendToUserDevices = async ({
  userId,
  title,
  body,
  data = {},
}: {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}) => {
  const devices = await prisma.device.findMany({
    where: { userId },
    select: { fcmToken: true },
  });

  if (devices.length === 0) return;

  const tokens = devices.map((d) => d.fcmToken);

  const response = await fcm.sendEachForMulticast({
    tokens,
    notification: { title, body },
    data,
  });

  // Handle dead or unregistered tokens
  const tokensToDelete: string[] = [];
  response.responses.forEach((res, idx) => {
    if (!res.success) {
      const error = res.error?.code;
      if (
        error === 'messaging/invalid-registration-token' ||
        error === 'messaging/registration-token-not-registered'
      ) {
        tokensToDelete.push(tokens[idx]);
      }
    }
  });

  if (tokensToDelete.length > 0) {
    await prisma.device.deleteMany({
      where: { fcmToken: { in: tokensToDelete } },
    });
  }
};
```

---

## 4. Asynchronous Queue Dispatch via BullMQ

Never call `fcm.sendEachForMulticast` synchronously within an Express request handler (e.g., when an instructor creates a new announcement for 5,000 students).

Always dispatch to BullMQ:

```typescript
import { addNotificationToQueue } from '../../queues/notification.queue';

// In Service:
await addNotificationToQueue({
  userId,
  title: 'New Assignment Published',
  body: 'Milestone 2 assignment has been posted.',
  data: { courseId, milestoneId },
});
```

---

## 5. In-App Notification Record

Whenever a push notification is sent, also persist an in-app notification record in `prisma/schema/notification.prisma`:

```typescript
await prisma.notification.create({
  data: {
    userId,
    title,
    message: body,
    type: 'ASSIGNMENT',
    isRead: false,
  },
});
```
