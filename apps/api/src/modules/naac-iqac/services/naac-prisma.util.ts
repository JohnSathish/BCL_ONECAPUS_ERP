import type { PrismaService } from '../../../database/prisma.service';

export type NaacDb = Record<string, any>;

export function naacDb(prisma: PrismaService): NaacDb {
  return prisma as unknown as NaacDb;
}
