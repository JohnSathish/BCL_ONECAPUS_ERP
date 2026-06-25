import type { PrismaService } from '../../../database/prisma.service';

/** Typed access until `prisma generate` is run after migration. */
export function officialDb(prisma: PrismaService) {
  return prisma as unknown as Record<string, any>;
}
