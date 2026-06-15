import type { PrismaService } from '../../../database/prisma.service';

export type GovernanceDb = Record<string, any>;

export function governanceDb(prisma: PrismaService): GovernanceDb {
  return prisma as unknown as GovernanceDb;
}
