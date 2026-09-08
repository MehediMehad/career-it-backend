---
name: s3-file-upload
description: Direct-to-S3 chunked multipart upload system using AWS SDK v3, presigned URLs, and database upload session tracking.
---

# Direct-to-S3 Chunked Multipart Upload Skill

## Purpose

Implement and maintain direct-to-S3 multipart uploads for video lessons, course banners, and profile assets without routing large binary streams through the Express server.

---

## 1. System Overview

Based on [FILE_UPLOAD_SYSTEM.md](file:///home/mehedimehad/project/career-it/career-it-backend/FILE_UPLOAD_SYSTEM.md):

- **Zero Proxy Bandwidth**: Clients upload directly to AWS S3/Cloud Storage buckets via cryptographically presigned PUT URLs.
- **Chunked Multipart Support**: Supports files from small images (5MB chunks) to multi-gigabyte video lessons.
- **Database State Machine**: Tracks sessions with states: `UPLOADING` $\rightarrow$ `COMPLETED` or `ABORTED`.

---

## 2. API Endpoints Lifecycle

### Stage 1: Initiate Upload Session

- **Route**: `POST /api/v1/uploads/initiate`
- **Input**: `{ fileName, fileSize, mimeType, category }`
- **Action**:
  1. Calls S3 `CreateMultipartUploadCommand`.
  2. Generates unique S3 `fileKey` (e.g., `uploads/courses/uuid-filename.mp4`).
  3. Creates `FileUpload` record in database with status `UPLOADING`.
- **Output**: `{ uploadId, fileKey, totalParts, chunkSize }`.

### Stage 2: Get Presigned Part URLs

- **Route**: `POST /api/v1/uploads/presigned-urls`
- **Input**: `{ uploadId, fileKey, partNumbers: [1, 2, ...] }`
- **Action**:
  1. Validates ownership and `UPLOADING` status.
  2. Generates presigned URLs using `getSignedUrl(s3Client, new UploadPartCommand(...), { expiresIn: 3600 })`.
- **Output**: Array of `{ partNumber, url }`.

### Stage 3: Complete Upload

- **Route**: `POST /api/v1/uploads/complete`
- **Input**: `{ uploadId, fileKey, parts: [{ PartNumber, ETag }] }`
- **Action**:
  1. Calls S3 `CompleteMultipartUploadCommand`.
  2. Updates database record status to `COMPLETED` and saves public file URL.
- **Output**: `{ fileUrl, status: 'COMPLETED' }`.

### Stage 4: Abort / Cleanup

- **Route**: `POST /api/v1/uploads/abort`
- **Input**: `{ uploadId, fileKey }`
- **Action**:
  1. Calls S3 `AbortMultipartUploadCommand` to free cloud storage.
  2. Marks database record `ABORTED`.

---

## 3. Storage Categories

Organize file keys by domain categories:

```typescript
export const UPLOAD_CATEGORIES = [
  'categories',
  'courses',
  'lessons',
  'avatars',
  'certificates',
] as const;
```

---

## 4. Security Rules for Uploads

1. Always validate MIME types and file extensions (e.g. `image/jpeg`, `image/png`, `video/mp4`).
2. Enforce file size maximums per category (e.g. 5MB for images, 2GB for course videos).
3. Require authentication for upload initiation.
4. Set CORS on the S3 bucket to allow `PUT` and expose `ETag` headers to frontend clients.
