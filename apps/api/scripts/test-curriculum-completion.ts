import { PrismaClient } from '@prisma/client';
import { CurriculumCompletionService } from '../src/modules/academic-engine/services/curriculum-completion.service';
import { CurriculumResolutionService } from '../src/modules/academic-engine/services/curriculum-resolution.service';

async function main() {
  const prisma = new PrismaClient();
  const curriculum = new CurriculumResolutionService(prisma as never);
  const svc = new CurriculumCompletionService(prisma as never, curriculum);
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    console.log('no tenant');
    return;
  }
  try {
    const summary = await svc.getSummary(tenant.id, {});
    console.log('summary ok', summary);
  } catch (e) {
    console.error('summary fail', e);
  }
  try {
    const matrix = await svc.getMatrix(tenant.id, {});
    console.log('matrix ok programmes', matrix.programmes.length);
  } catch (e) {
    console.error('matrix fail', e);
  }
  await prisma.$disconnect();
}

void main();
