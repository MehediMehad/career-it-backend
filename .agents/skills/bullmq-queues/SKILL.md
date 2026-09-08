---
name: bullmq-queues
description: Offload background tasks, email dispatch, push notifications, and asynchronous jobs using BullMQ queues and Redis workers.
---

# BullMQ Background Tasks & Queues Skill

## Purpose

Keep HTTP API responses fast and non-blocking by offloading long-running, external, or failure-prone tasks (emails, notifications, transcoding, batch jobs) to BullMQ background queues and Redis workers.

---

## 1. When to Use Background Queues

Never execute these inside Express request-response handlers:

- Email dispatch (`nodemailer`)
- Firebase push notifications (`firebase-admin`)
- Large file processing or video transcoding
- Generating complex PDF certificates or reports
- Third-party webhook sync

Instead: Dispatch a job to a BullMQ queue and return a prompt response to the client.

---

## 2. Queue & Worker Architecture

```text
src/
├── app/
│   ├── queues/           # Producers: functions that push jobs into Redis
│   │   ├── email.queue.ts
│   │   └── notification.queue.ts
│   └── workers/          # Consumers: workers processing jobs from Redis
│       ├── email.worker.ts
│       └── notification.worker.ts
└── worker.ts             # Process entrypoint initializing all workers
```

---

## 3. Producer Implementation (`src/app/queues/`)

```typescript
import { Queue } from 'bullmq';
import { redisConnection } from '../libs/redis';

export const EMAIL_QUEUE_NAME = 'email-queue';

export const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

export const addEmailToQueue = async (data: {
  to: string;
  subject: string;
  template: string;
  context: Record<string, unknown>;
}) => {
  await emailQueue.add('send-email', data);
};
```

---

## 4. Consumer / Worker Implementation (`src/app/workers/`)

```typescript
import { Worker, Job } from 'bullmq';
import { redisConnection } from '../libs/redis';
import { EMAIL_QUEUE_NAME } from '../queues/email.queue';
import { sendMail } from '../utils/mailer';

export const initEmailWorker = () => {
  const worker = new Worker(
    EMAIL_QUEUE_NAME,
    async (job: Job) => {
      const { to, subject, template, context } = job.data;
      await sendMail({ to, subject, template, context });
    },
    {
      connection: redisConnection,
      concurrency: 5,
    },
  );

  worker.on('completed', (job) => {
    console.log(`[BullMQ] Email Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[BullMQ] Email Job ${job?.id} failed:`, err.message);
  });

  return worker;
};
```

---

## 5. Worker Entrypoint (`src/worker.ts`)

Workers run in a separate standalone Node.js process:

- **Development Command**: `npm run worker`
- **Production Command**: `npm run worker:start`

Ensure all workers are instantiated inside `src/worker.ts` with clean SIGINT/SIGTERM shutdown handlers.
