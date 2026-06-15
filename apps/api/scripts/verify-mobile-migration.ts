import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const perms = await prisma.permission.findMany({
    where: { slug: { startsWith: 'mobile:' } },
    select: { slug: true },
  });
  const tables = await prisma.$queryRaw<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'platform' AND table_name LIKE 'mobile_%'
    ORDER BY table_name`;
  const metadataCol = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'platform' AND table_name = 'refresh_sessions' AND column_name = 'metadata'`;
  console.log(
    JSON.stringify(
      { perms, tables: tables.map((t) => t.table_name), metadataCol },
      null,
      2,
    ),
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
