---
name: api-validation-error
description: Implement request validation using Zod, handle query filters and pagination, and manage error propagation via ApiError and globalErrorHandler.
---

# API Validation & Error Handling Skill

## Purpose

Enforce strict request payload validation with Zod and maintain uniform error handling across the entire API.

---

## 1. Request Validation with Zod

All incoming requests with body, query, or parameters must be validated using Zod schemas executed via the `validateRequest` middleware.

### Schema Definition Pattern (`<module>.validation.ts`)

```typescript
import { z } from 'zod';

const createCourseSchema = z.object({
  body: z.object({
    title: z
      .string({
        required_error: 'Course title is required',
      })
      .min(3, 'Title must be at least 3 characters'),
    description: z.string().optional(),
    categoryId: z.string({
      required_error: 'Category ID is required',
    }),
    price: z
      .number({
        required_error: 'Price is required',
      })
      .min(0, 'Price cannot be negative'),
  }),
});

const updateCourseSchema = z.object({
  body: z.object({
    title: z.string().min(3).optional(),
    description: z.string().optional(),
    categoryId: z.string().optional(),
    price: z.number().min(0).optional(),
    isDeleted: z.boolean().optional(),
  }),
});

export const CourseValidations = {
  createCourseSchema,
  updateCourseSchema,
};
```

### Route Middleware Attachment

```typescript
router.post(
  '/',
  auth(UserRoleEnum.ADMIN),
  validateRequest(CourseValidations.createCourseSchema),
  CourseControllers.createCourse,
);
```

---

## 2. Error Throwing Standards

- Never throw generic strings or plain `Error`.
- Throw custom `ApiError` with appropriate HTTP status code from `http-status`.

```typescript
import httpStatus from 'http-status';
import ApiError from '../../errors/ApiError';

// Record not found
if (!isCategoryExist) {
  throw new ApiError(httpStatus.NOT_FOUND, 'Category not found');
}

// Conflict / Duplicate entry
if (isSlugTaken) {
  throw new ApiError(httpStatus.CONFLICT, 'A category with this title already exists');
}

// Unauthorized / Forbidden
if (user.role !== UserRoleEnum.ADMIN) {
  throw new ApiError(httpStatus.FORBIDDEN, 'You do not have permission to perform this action');
}
```

---

## 3. Global Error Handling (`globalErrorHandler.ts`)

The centralized `globalErrorHandler` catches all errors passed through Express:

- **ZodError**: Formats nested validation issues into a clean `{ path, message }` array.
- **PrismaClientKnownRequestError**:
  - `P2002`: Unique constraint violation (e.g. duplicate email/slug) -> 409 Conflict.
  - `P2025`: Record to delete/update does not exist -> 404 Not Found.
  - `P2003`: Foreign key constraint failed -> 400 Bad Request.
- **JsonWebTokenError / TokenExpiredError**: 401 Unauthorized.
- **ApiError**: Custom status code and message.
- **Internal Server Error**: 500 with stack trace in development, sanitized in production.

---

## 4. Response Standardization

All successful responses must pass through `sendResponse`:

```typescript
sendResponse(res, {
  statusCode: httpStatus.OK,
  success: true,
  message: 'Fetched successfully',
  meta: {
    page: 1,
    limit: 10,
    total: 45,
  },
  data: result,
});
```
