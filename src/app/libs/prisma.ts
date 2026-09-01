import path from 'path';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:Mehedi0610@localhost:5432/career_it_db?schema=public';

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

export default prisma;
