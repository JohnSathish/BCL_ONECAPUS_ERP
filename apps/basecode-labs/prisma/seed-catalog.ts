import { PrismaClient } from '@prisma/client';
import { upsertCatalog } from './upsert-catalog';

const prisma = new PrismaClient();

async function main() {
  await upsertCatalog(prisma);
  const [products, testimonials] = await Promise.all([
    prisma.product.count(),
    prisma.testimonial.count(),
  ]);
  console.log('catalog ready', { products, testimonials });
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
