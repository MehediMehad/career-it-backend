import dotenv from 'dotenv';
import path from 'path';
import { defineConfig, env } from 'prisma/config';

dotenv.config({ path: path.join(__dirname, '.env'), override: true });

export default defineConfig({
  schema: './prisma/schema',
  migrations: {
    path: './prisma/schema/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
