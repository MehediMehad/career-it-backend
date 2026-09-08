---
name: database-migrations-seeding
description: Safely execute PostgreSQL schema migrations, handle production database deployments, create idempotent seeders, and populate default admin/master data.
---

# Database Migrations & Seeding Skill

## Purpose

Maintain database schema evolution using Prisma migrations and provide reproducible, idempotent database seeders for development and staging in `career-it-backend`.

---

## 1. Development Migrations vs. Production Deployments

### In Local Development:

When you update or add models in `prisma/schema/*.prisma`:

```bash
# 1. Generate updated TypeScript types
npm run prisma:generate

# 2. Create and apply a new migration
npx prisma migrate dev --name <meaningful_migration_name>
```

### In Production / CI-CD:

Never use `prisma migrate dev` or `prisma db push` in production. Always use:

```bash
npx prisma migrate deploy
```

---

## 2. Idempotent Database Seeding

Seeders must be **idempotent** (can be executed multiple times without creating duplicate records or throwing unique constraint errors).

### Creating a Seeder (`prisma/seed.ts`)

```typescript
import bcrypt from 'bcrypt';
import { UserRoleEnum } from '@prisma/client';
import prisma from '../src/app/libs/prisma';

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Seed Super Admin
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@careerit.com';
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('Admin@123456', 12);
    await prisma.user.create({
      data: {
        name: 'System Admin',
        email: adminEmail,
        password: hashedPassword,
        role: UserRoleEnum.ADMIN,
        isVerified: true,
      },
    });
    console.log('✅ Super Admin created.');
  }

  // 2. Seed Default Categories
  const defaultCategories = [
    { title: 'Web Development', slug: 'web-development' },
    { title: 'Cyber Security', slug: 'cyber-security' },
    { title: 'Data Science & AI', slug: 'data-science-ai' },
    { title: 'Cloud Computing & DevOps', slug: 'cloud-computing-devops' },
  ];

  for (const cat of defaultCategories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: {
        title: cat.title,
        slug: cat.slug,
      },
    });
  }
  console.log('✅ Default categories seeded.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

### Package.json Seed Script Configuration:

```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

Run seeding:

```bash
npx prisma db seed
```

---

## 3. Migration Troubleshooting & Safety

1. **Destructive Changes**: Dropping columns or changing column types requires creating a migration with caution. Always back up database tables before dropping columns in production.
2. **Failed Migrations**: If a migration fails mid-way, use `npx prisma migrate resolve --rolled-back <migration_name>` or `--applied <migration_name>` to fix the migration status.
3. **Prisma Studio**: Inspect database contents visually:
   ```bash
   npm run prisma:studio
   ```
