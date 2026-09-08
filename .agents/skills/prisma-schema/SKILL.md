---
name: prisma-schema
description: Manage multi-file modular Prisma schemas in prisma/schema/*.prisma, relations, migrations, indexes, and client generation for PostgreSQL.
---

# Prisma Modular Schema Management Skill

## Purpose

Maintain and extend the multi-file modular Prisma architecture for PostgreSQL in `career-it-backend`.

---

## 1. Modular Schema Principles

- Schemas are split into individual `.prisma` files inside `prisma/schema/`.
- **Never create or edit a monolithic root `schema.prisma` in `prisma/`**.
- The generator and datasource are configured in `prisma/schema/schema.prisma` and routed via `prisma.config.ts`.
- File naming matches the model domain: e.g., `course.prisma`, `category.prisma`, `lesson.prisma`.

---

## 2. Model Structure Standards

Every model in `prisma/schema/<model>.prisma` must adhere to:

1. **Primary Key**: Use `String @id @default(uuid())`.
2. **Timestamps**: Always include `createdAt DateTime @default(now())` and `updatedAt DateTime @updatedAt`.
3. **Table Mapping**: Always map to lowercase plural snake_case table names using `@@map("table_names")`.
4. **Soft Delete**: Include `isDeleted Boolean @default(false)` when models support soft deletion.
5. **Foreign Key Indexes**: Add `@@index([foreignKey])` on relational foreign keys for database query performance.

### Example Model:

```prisma
model CourseReview {
  id        String   @id @default(uuid())
  courseId  String
  studentId String
  rating    Int
  comment   String?
  isDeleted Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  course  Course @relation(fields: [courseId], references: [id], onDelete: Cascade)
  student User   @relation(fields: [studentId], references: [id], onDelete: Cascade)

  @@index([courseId])
  @@index([studentId])
  @@map("course_reviews")
}
```

---

## 3. Workflow for Schema Changes

When adding a new model or updating fields:

1. **Create or Update File**:
   Create or edit the relevant file inside `prisma/schema/<name>.prisma`.
2. **Rebuild Prisma Client**:
   ```bash
   npm run prisma:generate
   ```
3. **Run Migration or DB Push**:
   - For production-grade tracked migrations:
     ```bash
     npx prisma migrate dev --name <migration_description>
     ```
   - To inspect current database state:
     ```bash
     npm run prisma:studio
     ```

---

## 4. Prisma Query Best Practices

### A. Avoid N+1 Queries

Always use `include` or `select` to fetch relations eagerly instead of running queries in a loop:

```typescript
// Good: Single query with eager loading
const courses = await prisma.course.findMany({
  where: { isDeleted: false },
  include: {
    category: true,
    instructor: {
      select: { id: true, name: true, email: true },
    },
  },
});
```

### B. Use Transactions for Atomic Operations

When updating multiple related tables:

```typescript
await prisma.$transaction(async (tx) => {
  const course = await tx.course.create({ data: courseData });
  await tx.milestone.createMany({
    data: milestones.map((m) => ({ ...m, courseId: course.id })),
  });
});
```

### C. Soft Delete Handling

Always filter out soft-deleted records:

```typescript
where: {
  isDeleted: false,
}
```
