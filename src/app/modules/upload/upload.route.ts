import { UserRoleEnum } from '@prisma/client';
import express from 'express';

import { UploadControllers } from './upload.controller';
import { UploadValidations } from './upload.validation';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';

const router = express.Router();

// 1. Initiate Multipart Upload Session
router.post(
  '/initiate',
  auth(UserRoleEnum.STUDENT, UserRoleEnum.INSTRUCTOR, UserRoleEnum.ADMIN),
  validateRequest(UploadValidations.initiateUpload),
  UploadControllers.initiateUpload,
);

// 2. Get Presigned URLs for Chunk Uploads
router.post(
  '/presigned-urls',
  auth(UserRoleEnum.STUDENT, UserRoleEnum.INSTRUCTOR, UserRoleEnum.ADMIN),
  validateRequest(UploadValidations.getPresignedUrls),
  UploadControllers.getPresignedUrls,
);

// 3. Complete Multipart Upload Session
router.post(
  '/complete',
  auth(UserRoleEnum.STUDENT, UserRoleEnum.INSTRUCTOR, UserRoleEnum.ADMIN),
  validateRequest(UploadValidations.completeUpload),
  UploadControllers.completeUpload,
);

// 4. Abort Multipart Upload Session
router.post(
  '/abort',
  auth(UserRoleEnum.STUDENT, UserRoleEnum.INSTRUCTOR, UserRoleEnum.ADMIN),
  validateRequest(UploadValidations.abortUpload),
  UploadControllers.abortUpload,
);

// 5. Track Upload Status
router.get(
  '/status/:uploadId',
  auth(UserRoleEnum.STUDENT, UserRoleEnum.INSTRUCTOR, UserRoleEnum.ADMIN),
  UploadControllers.getUploadStatus,
);

export const UploadRoutes = router;
