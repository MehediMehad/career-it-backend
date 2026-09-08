---
name: api-testing
description: Test Express API endpoints, validate request/response contracts, verify authentication headers and RBAC permissions, and synchronize Postman collections.
---

# Backend API Testing & Verification Skill

## Purpose

Validate Express REST API endpoints, verify RBAC permissions, assert response structures, and keep API documentation/Postman collections synchronized in `career-it-backend`.

---

## 1. Automated Integration Testing with Supertest

Validate complete HTTP request/response lifecycles against Express app instances:

```typescript
import request from 'supertest';
import httpStatus from 'http-status';
import app from '../../app';
import prisma from '../../libs/prisma';

describe('Category API Endpoints (/api/v1/categories)', () => {
  let adminToken: string;

  beforeAll(async () => {
    // Generate auth token or login test user
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@careerit.com', password: 'Password123!' });
    adminToken = res.body.data.accessToken;
  });

  it('GET /api/v1/categories - should return list of categories', async () => {
    const res = await request(app).get('/api/v1/categories').expect(httpStatus.OK);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /api/v1/categories - should reject unauthenticated requests', async () => {
    await request(app)
      .post('/api/v1/categories')
      .send({ title: 'New Test Category' })
      .expect(httpStatus.UNAUTHORIZED);
  });

  it('POST /api/v1/categories - should create category when Admin', async () => {
    const res = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Artificial Intelligence' })
      .expect(httpStatus.CREATED);

    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Artificial Intelligence');
  });
});
```

---

## 2. Testing RBAC & Auth Guards Checklist

For every protected endpoint:

1. **Missing Token**: Verify response is `401 Unauthorized`.
2. **Invalid / Expired Token**: Verify response is `401 Unauthorized`.
3. **Blacklisted Token**: Verify response is `401 Unauthorized`.
4. **Insufficient Role**: Verify user with role `STUDENT` receives `403 Forbidden` on admin routes.
5. **Valid Role**: Verify request succeeds with `200 OK` or `201 Created`.

---

## 3. Postman Collection Synchronization (`postman_collection.json`)

When creating or updating API routes:

1. Keep [postman_collection.json](file:///home/mehedimehad/project/career-it/career-it-backend/postman_collection.json) updated with new endpoints.
2. Store environment variables for `baseUrl` (e.g. `http://localhost:5000/api/v1`) and `authToken` (`Bearer {{token}}`).
3. Include sample JSON request payloads and query parameters.
