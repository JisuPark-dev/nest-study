import { defineConfig } from '@mikro-orm/core';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { UserMikroOrm } from './domain/users/entity/user.mikroorm.entity';

export default defineConfig({
  driver: PostgreSqlDriver,
  entities: [UserMikroOrm],
  dbName: process.env.DATABASE_NAME || 'nest-redis-test',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
  debug: process.env.NODE_ENV !== 'production',
  allowGlobalContext: true,
});