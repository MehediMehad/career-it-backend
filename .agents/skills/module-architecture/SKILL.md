---
name: module-architecture
description: Create, structure, and wire modular backend features in Express.js following clean layered architecture (routes, controllers, services, validations, interfaces).
---

# Backend Modular Architecture Skill

## Purpose

Enforce clean, scalable, and maintainable modular architecture for all backend features in `career-it-backend`. Every feature must be encapsulated in its own self-contained module under `src/app/modules/<module_name>/`.

---

## 1. Module File Structure

For every feature module (e.g. `categories`, `courses`, `enrollments`), maintain these standard files:

```text
src/app/modules/<module-name>/
├── <name>.interface.ts   # TypeScript interfaces & custom types
├── <name>.validation.ts  # Zod validation schemas for request body/query/params
├── <name>.constant.ts    # Searchable fields, filterable fields, pagination constants
├── <name>.service.ts     # Business logic & Prisma database operations
├── <name>.controller.ts  # Request extraction, service invocation, and response formatting
└── <name>.route.ts       # Express router with auth guards and validation middleware
```

---

## 2. Layer Responsibilities

### Route Layer (`<name>.route.ts`)

- Define HTTP endpoints (`router.post`, `router.get`, `router.patch`, `router.delete`).
- Apply authentication and authorization guards using `auth(UserRoleEnum.ADMIN, ...)`.
- Apply input validation using `validateRequest(Schema)`.
- Export the router as `<Name>Routes` and register it in `src/routes/index.ts`.

```typescript
import express from 'express';
import { UserRoleEnum } from '@prisma/client';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { ExampleControllers } from './example.controller';
import { ExampleValidations } from './example.validation';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.ADMIN),
  validateRequest(ExampleValidations.createExampleSchema),
  ExampleControllers.createExample,
);

router.get('/', ExampleControllers.getAllExamples);
router.get('/:id', ExampleControllers.getSingleExample);
router.patch(
  '/:id',
  auth(UserRoleEnum.ADMIN),
  validateRequest(ExampleValidations.updateExampleSchema),
  ExampleControllers.updateExample,
);
router.delete('/:id', auth(UserRoleEnum.ADMIN), ExampleControllers.deleteExample);

export const ExampleRoutes = router;
```

### Controller Layer (`<name>.controller.ts`)

- Wrap all handler functions inside `catchAsync(...)` to avoid repetitive `try/catch`.
- Extract query filters and pagination options using `pick(req.query, [...])`.
- Never write direct database queries inside controllers.
- Return standardized JSON responses via `sendResponse(res, { statusCode, success, message, data, meta })`.

```typescript
import type { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../helpers/catchAsync';
import pick from '../../helpers/pick';
import sendResponse from '../../utils/sendResponse';
import { ExampleServices } from './example.service';
import { exampleFilterableFields } from './example.constant';
import { paginationFields } from '../../constants/pagination';

const createExample = catchAsync(async (req: Request, res: Response) => {
  const result = await ExampleServices.createExample(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Example created successfully',
    data: result,
  });
});

const getAllExamples = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(req.query, exampleFilterableFields);
  const options = pick(req.query, paginationFields);

  const result = await ExampleServices.getAllExamples(filters, options);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Examples fetched successfully',
    meta: result.meta,
    data: result.data,
  });
});

export const ExampleControllers = {
  createExample,
  getAllExamples,
};
```

### Service Layer (`<name>.service.ts`)

- Implement all business logic and Prisma client interactions.
- Use `paginationHelper.calculatePagination(options)` for consistent pagination calculation (`page`, `limit`, `skip`, `sortBy`, `sortOrder`).
- Build dynamic search and filter conditions (`andConditions`).
- Throw `ApiError(httpStatus.NOT_FOUND, '...')` when records are missing or unauthorized.
- Use Prisma transactions `prisma.$transaction(...)` when multi-table consistency is required.

```typescript
import { Prisma } from '@prisma/client';
import prisma from '../../libs/prisma';
import ApiError from '../../errors/ApiError';
import httpStatus from 'http-status';
import { paginationHelper } from '../../helpers/paginationHelper';
import { IPaginationOptions } from '../../interface/pagination.interface';
import { IExampleFilterRequest } from './example.interface';
import { exampleSearchableFields } from './example.constant';

const createExample = async (payload: Prisma.ExampleCreateInput) => {
  const result = await prisma.example.create({
    data: payload,
  });
  return result;
};

const getAllExamples = async (filters: IExampleFilterRequest, options: IPaginationOptions) => {
  const { limit, page, skip, sortBy, sortOrder } = paginationHelper.calculatePagination(options);
  const { searchTerm, ...filterData } = filters;

  const andConditions: Prisma.ExampleWhereInput[] = [];

  if (searchTerm) {
    andConditions.push({
      OR: exampleSearchableFields.map((field) => ({
        [field]: {
          contains: searchTerm,
          mode: 'insensitive',
        },
      })),
    });
  }

  if (Object.keys(filterData).length > 0) {
    andConditions.push({
      AND: Object.keys(filterData).map((key) => ({
        [key]: {
          equals: (filterData as Record<string, unknown>)[key],
        },
      })),
    });
  }

  const whereConditions: Prisma.ExampleWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const result = await prisma.example.findMany({
    where: whereConditions,
    skip,
    take: limit,
    orderBy: { [sortBy]: sortOrder },
  });

  const total = await prisma.example.count({ where: whereConditions });

  return {
    meta: { page, limit, total },
    data: result,
  };
};

export const ExampleServices = {
  createExample,
  getAllExamples,
};
```

---

## 3. Router Registration

Always register the new router in `src/routes/index.ts`:

```typescript
import { ExampleRoutes } from '../app/modules/example/example.route';

const moduleRoutes = [
  // ... existing routes
  {
    path: '/examples',
    route: ExampleRoutes,
  },
];
```

---

## 4. Verification Checklist

1. Interfaces defined without `any`.
2. Zod schemas validate body, params, or query before hitting controller.
3. Controller uses `catchAsync` and `sendResponse`.
4. Service uses `paginationHelper` and handles missing records via `ApiError`.
5. Run `npm run lint` and `npm run build` to ensure type-safety.
