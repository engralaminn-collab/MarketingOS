import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function resolveSqliteUrl(): string {
  const raw = (process.env.DATABASE_URL || 'file:./db/custom.db').trim();
  if (raw.startsWith('file:')) {
    const filePart = raw.slice('file:'.length).split('?')[0];
    if (filePart && filePart !== ':memory:') {
      const resolvedPath = path.isAbsolute(filePart)
        ? filePart
        : path.resolve(/*turbopackIgnore: true*/ process.cwd(), filePart);
      fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
      return `file:${resolvedPath}`;
    }
  }
  return raw;
}

function createPrismaClient(): PrismaClient {
  const url = resolveSqliteUrl();
  const adapter = new PrismaLibSQL({ url });
  return new PrismaClient({
    adapter,
    log: ['error'],
  });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}
