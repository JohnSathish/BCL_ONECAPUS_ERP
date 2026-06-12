/**
 * Migrates legacy StudentProfile.address JSON and guardian scalars into normalized tables.
 * Run: npm run migrate:student-profile-legacy
 */
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type LegacyAddress = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  district?: string;
  pinCode?: string;
  pin?: string;
  tura?: LegacyAddress;
  home?: LegacyAddress;
  correspondence?: LegacyAddress;
};

function pickAddressFields(src: LegacyAddress | undefined) {
  if (!src) return null;
  const line1 = src.line1?.trim();
  const line2 = src.line2?.trim();
  const city = src.city?.trim();
  const state = src.state?.trim();
  const district = src.district?.trim();
  const pinCode = (src.pinCode ?? src.pin)?.trim();
  if (!line1 && !line2 && !city && !state && !district && !pinCode) return null;
  return { line1, line2, city, state, district, pinCode };
}

async function main() {
  const profiles = await prisma.studentProfile.findMany({
    where: {
      OR: [
        { address: { not: Prisma.DbNull } },
        { guardianName: { not: null } },
        { guardianMobile: { not: null } },
      ],
    },
    select: {
      id: true,
      tenantId: true,
      studentId: true,
      address: true,
      guardianName: true,
      guardianMobile: true,
    },
  });

  let addressCreated = 0;
  let guardianCreated = 0;

  for (const profile of profiles) {
    const raw = profile.address as LegacyAddress | null;
    if (raw) {
      const entries: {
        type: 'TURA' | 'HOME' | 'CORRESPONDENCE';
        data: ReturnType<typeof pickAddressFields>;
      }[] = [
        { type: 'TURA', data: pickAddressFields(raw.tura ?? raw) },
        { type: 'HOME', data: pickAddressFields(raw.home) },
        { type: 'CORRESPONDENCE', data: pickAddressFields(raw.correspondence) },
      ];

      for (const entry of entries) {
        if (!entry.data) continue;
        const existing = await prisma.studentAddress.findFirst({
          where: { studentId: profile.studentId, addressType: entry.type },
        });
        if (existing) continue;
        await prisma.studentAddress.create({
          data: {
            tenantId: profile.tenantId,
            studentId: profile.studentId,
            addressType: entry.type,
            ...entry.data,
          },
        });
        addressCreated += 1;
      }
    }

    if (profile.guardianName || profile.guardianMobile) {
      const existing = await prisma.studentGuardian.findFirst({
        where: { studentId: profile.studentId, guardianType: 'LOCAL_GUARDIAN' },
      });
      if (!existing) {
        await prisma.studentGuardian.create({
          data: {
            tenantId: profile.tenantId,
            studentId: profile.studentId,
            guardianType: 'LOCAL_GUARDIAN',
            fullName: profile.guardianName ?? undefined,
            contactNumber: profile.guardianMobile ?? undefined,
          },
        });
        guardianCreated += 1;
      }
    }
  }

  console.log(
    `Legacy profile migration complete: ${profiles.length} profiles scanned, ${addressCreated} addresses created, ${guardianCreated} guardians created.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
