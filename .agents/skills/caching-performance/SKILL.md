---
name: caching-performance
description: Implement Redis Cache-Aside pattern, automated cache invalidation on mutations, TTL expiration strategies, and query performance optimization.
---

# Redis Caching & Performance Optimization Skill

## Purpose

Boost read performance and reduce PostgreSQL database load using the Redis Cache-Aside pattern and automated cache invalidation in `career-it-backend`.

---

## 1. Redis Cache-Aside Pattern

For high-read, low-write endpoints (e.g. `categories`, `featured courses`, `platform stats`):

1. **Check Cache**: Check if data exists in Redis.
2. **Hit**: Return cached JSON immediately.
3. **Miss**: Query PostgreSQL via Prisma.
4. **Populate**: Save result in Redis with an appropriate TTL (Time-To-Live).

```typescript
import redisClient from '../../libs/redis';
import prisma from '../../libs/prisma';

const CACHE_TTL_SECONDS = 3600; // 1 hour

const getCachedCategories = async () => {
  const cacheKey = 'categories:all';

  // 1. Try reading from cache
  const cachedData = await redisClient.get(cacheKey);
  if (cachedData) {
    return JSON.parse(cachedData);
  }

  // 2. Query database
  const categories = await prisma.category.findMany({
    where: { isDeleted: false },
    orderBy: { createdAt: 'desc' },
  });

  // 3. Store in cache
  await redisClient.set(cacheKey, JSON.stringify(categories), 'EX', CACHE_TTL_SECONDS);

  return categories;
};
```

---

## 2. Automated Cache Invalidation on Mutations

Whenever a mutation occurs (Create, Update, Delete), invalidate affected cache keys to prevent stale data:

```typescript
const createCategory = async (payload: ICreateCategoryInput) => {
  const result = await prisma.category.create({ data: payload });

  // Invalidate categories cache
  await redisClient.del('categories:all');

  return result;
};

const updateCategory = async (id: string, payload: IUpdateCategoryInput) => {
  const result = await prisma.category.update({
    where: { id },
    data: payload,
  });

  // Invalidate both collection and specific item cache
  await redisClient.del('categories:all');
  await redisClient.del(`category:${id}`);

  return result;
};
```

---

## 3. Recommended TTL Strategies

| Data Type               | Cache Key Pattern   | Suggested TTL       | Invalidation Trigger             |
| :---------------------- | :------------------ | :------------------ | :------------------------------- |
| **All Categories**      | `categories:all`    | 1 Hour (`3600s`)    | On category create/update/delete |
| **Single Course**       | `course:<id>`       | 15 Minutes (`900s`) | On course/lesson update          |
| **Platform Statistics** | `stats:overview`    | 10 Minutes (`600s`) | Scheduled recalculation          |
| **User Profile Cache**  | `user:<id>:profile` | 5 Minutes (`300s`)  | On profile edit                  |

---

## 4. Query Performance Best Practices

1. **Avoid `SELECT *`**: Always use `select` to fetch only required fields from PostgreSQL.
2. **Index Usage**: Ensure fields in `where`, `orderBy`, and foreign keys have `@@index` in `prisma/schema/*.prisma`.
3. **Pagination Boundaries**: Enforce maximum limits (`Math.min(limit, 100)`) to prevent accidental denial-of-service queries.
4. **Parallel Execution**: Use `Promise.all` for independent queries:
   ```typescript
   const [items, total] = await Promise.all([
     prisma.course.findMany({ where, skip, take }),
     prisma.course.count({ where }),
   ]);
   ```
