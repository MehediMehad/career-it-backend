---
name: cron-jobs
description: Implement recurring scheduled jobs, automated cleanup of stale upload sessions, maintenance routines, and scheduled notifications using node-cron or BullMQ repeatables.
---

# Scheduled Cron Jobs & Maintenance Skill

## Purpose

Implement recurring background maintenance jobs (e.g. cleaning orphaned S3 upload sessions, expiring inactive OTPs, daily digest reports) in `career-it-backend`.

---

## 1. Scheduling Options

1. **`node-cron`**: Ideal for lightweight, in-process periodic tasks (e.g. every midnight cleanup).
2. **BullMQ Repeatable Jobs**: Recommended when recurring jobs must be distributed across clustered worker instances without running redundantly on multiple servers.

---

## 2. Implementing a Scheduled Task (`node-cron`)

### Architecture Placement:

Place scheduler routines in `src/app/schedulers/` or invoke them from `src/server.ts` or `src/worker.ts`:

```typescript
import cron from 'node-cron';
import { cleanupStaleUploadSessions } from './uploadCleanup.job';

export const initSchedulers = () => {
  // Run daily at 02:00 AM (server time)
  cron.schedule('0 2 * * *', async () => {
    console.log('[Cron] Running daily midnight maintenance...');
    await cleanupStaleUploadSessions();
  });
};
```

---

## 3. Example: Cleaning Stale S3 Multipart Uploads

Aborted or unfinished multipart uploads can consume AWS S3 storage costs indefinitely. A cron job checks for sessions stuck in `UPLOADING` status older than 24 hours:

```typescript
import prisma from '../libs/prisma';
import { s3Client } from '../libs/s3Client';
import { AbortMultipartUploadCommand } from '@aws-sdk/client-s3';
import config from '../../configs';

export const cleanupStaleUploadSessions = async () => {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Find sessions still in UPLOADING status created more than 24h ago
  const staleUploads = await prisma.fileUpload.findMany({
    where: {
      status: 'UPLOADING',
      createdAt: { lt: oneDayAgo },
    },
    take: 50,
  });

  for (const upload of staleUploads) {
    try {
      if (upload.uploadId && upload.fileKey) {
        // 1. Tell S3 to abort and delete incomplete parts
        await s3Client.send(
          new AbortMultipartUploadCommand({
            Bucket: config.aws.s3_bucket,
            Key: upload.fileKey,
            UploadId: upload.uploadId,
          }),
        );
      }

      // 2. Mark database record as ABORTED
      await prisma.fileUpload.update({
        where: { id: upload.id },
        data: { status: 'ABORTED' },
      });
      console.log(`[Cron] Aborted stale upload: ${upload.fileKey}`);
    } catch (err: unknown) {
      console.error(`[Cron] Failed to abort upload ${upload.id}:`, err);
    }
  }
};
```

---

## 4. Best Practices for Cron Tasks

1. **Catch Errors**: Never let an uncaught exception inside a cron handler crash the Node.js process.
2. **Limit Batch Size**: Always use `take: 50` or `take: 100` rather than querying thousands of records at once.
3. **Execution Locks / Single Runner**: In clustered environments, use Redis distributed locks (e.g. `redlock` or BullMQ repeatable jobs) so the cron job runs only once per schedule across all containers.
