/**
 * Verify careers portal public API end-to-end (read paths).
 *
 *   npx ts-node --transpile-only scripts/verify-careers-portal-e2e.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3001/api';
const CAREER_HOST = process.env.CAREER_HOST ?? 'career.demo.localhost';

async function apiGet(path: string) {
  const res = await fetch(`${API}${path}`, {
    headers: {
      'X-Login-Host': CAREER_HOST,
      Accept: 'application/json',
    },
  });
  const json = await res.json();
  return { ok: res.ok, status: res.status, json };
}

async function main() {
  console.log('\nCareers Portal E2E Verification\n');
  console.log(`API: ${API}`);
  console.log(`Host: ${CAREER_HOST}\n`);

  const domain = await prisma.tenantDomain.findFirst({
    where: { host: CAREER_HOST, deletedAt: null },
    include: { tenant: true },
  });
  if (!domain?.tenant) {
    console.error(
      '✗ Career domain not registered. Run: npx ts-node --transpile-only scripts/ensure-career-portal.ts',
    );
    process.exit(1);
  }
  console.log(`✓ Tenant domain: ${domain.host} → ${domain.tenant.slug}`);

  const info = await apiGet('/v1/careers/portal/info');
  if (!info.ok) {
    console.error('✗ GET /careers/portal/info failed', info.status, info.json);
    process.exit(1);
  }
  const infoData = info.json?.data ?? info.json;
  console.log(
    `✓ Portal info: ${infoData.collegeName} (${infoData.openVacancies ?? 0} open)`,
  );

  const jobs = await apiGet('/v1/careers/portal/jobs');
  if (!jobs.ok) {
    console.error('✗ GET /careers/portal/jobs failed', jobs.status);
    process.exit(1);
  }
  const jobList = jobs.json?.data ?? jobs.json;
  const count = Array.isArray(jobList) ? jobList.length : 0;
  console.log(`✓ Published jobs listed: ${count}`);

  if (count > 0) {
    const first = jobList[0];
    const slug = first.slug ?? first.id;
    const detail = await apiGet(`/v1/careers/portal/jobs/${slug}`);
    if (!detail.ok) {
      console.error(`✗ GET job detail /jobs/${slug} failed`, detail.status);
      process.exit(1);
    }
    const job = detail.json?.data ?? detail.json;
    if (!job?.id || !job?.title) {
      console.error(
        '✗ Job detail missing id/title (check API envelope unwrapping on SSR)',
      );
      process.exit(1);
    }
    console.log(`✓ Job detail: ${job.title} (id: ${job.id.slice(0, 8)}…)`);
  } else {
    console.log(
      '! No published vacancies — publish one in HR → Recruitment to test apply flow',
    );
  }

  const apps = await prisma.recruitmentApplication.count({
    where: { tenantId: domain.tenantId, source: 'PUBLIC' },
  });
  console.log(`✓ Public applications in ATS: ${apps}`);

  console.log('\nManual steps remaining:');
  console.log('  1. HR → Recruitment → create vacancy → Publish');
  console.log('  2. career.demo.localhost → apply → upload docs → submit');
  console.log('  3. Track application with application no + mobile');
  console.log('  4. HR → ATS board → verify application appears\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
