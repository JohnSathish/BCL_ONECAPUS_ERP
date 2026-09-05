import type { Prisma, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { defaultTpsKg2027Settings } from '../../src/modules/school-admissions/school-admission.constants';

const TPS_HOSTS = [
  'admission.turapublicschool.com',
  'erp.turapublicschool.com',
  'admission.tps.localhost',
  'tps.localhost',
] as const;

const ADMIN_PERMISSIONS = [
  'admissions:read',
  'admissions:manage',
  'admissions:configure',
  'admissions:verify-documents',
  'admissions:enroll',
  'admissions:portal:self',
  'communication:read',
  'communication:manage',
  'users:read',
  'users:manage',
  'org:read',
  'org:manage',
  'lookups:read',
  'reports:read',
  'notifications:read',
  'license:read',
  'students:read',
  'tenant:read',
];

export async function seedTuraPublicSchool(
  prisma: PrismaClient,
  passwordHash?: string,
) {
  const hash = passwordHash ?? (await bcrypt.hash('Admin@123', 12));
  const settings = defaultTpsKg2027Settings();

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'tura-public-school' },
    update: { name: 'Tura Public School', status: 'active' },
    create: {
      name: 'Tura Public School',
      slug: 'tura-public-school',
      status: 'active',
    },
  });

  for (const host of TPS_HOSTS) {
    await prisma.tenantDomain.upsert({
      where: { host },
      update: { tenantId: tenant.id, verified: true, deletedAt: null },
      create: { tenantId: tenant.id, host, verified: true },
    });
  }

  await prisma.tenantBranding.upsert({
    where: { tenantId: tenant.id },
    update: {
      displayName: 'Tura Public School, Tura',
      shortName: 'TPS Tura',
      campusName: 'Tura, West Garo Hills, Meghalaya',
      portalSubtitle: 'K.G. Admission — Academic Session 2027',
      productName: 'TPS Admissions',
      productTagline: 'Glow in Integrity',
      poweredByText: 'Powered by BaseCode Labs Pvt. Ltd.',
      address: 'Tura, West Garo Hills, Meghalaya',
      badges: [
        'Affiliated to the Council for the Indian School Certificate Examinations, New Delhi',
      ],
      primaryColor: '#1b4d3e',
      accentColor: '#c5a572',
      sidebarColor: '#14382d',
      loginBackgroundStyle: 'gradient',
      showPoweredBy: true,
      brandingEnabled: true,
      portalExtrasJson: { institutionType: 'SCHOOL' },
    },
    create: {
      tenantId: tenant.id,
      displayName: 'Tura Public School, Tura',
      shortName: 'TPS Tura',
      campusName: 'Tura, West Garo Hills, Meghalaya',
      portalSubtitle: 'K.G. Admission — Academic Session 2027',
      productName: 'TPS Admissions',
      productTagline: 'Glow in Integrity',
      poweredByText: 'Powered by BaseCode Labs Pvt. Ltd.',
      address: 'Tura, West Garo Hills, Meghalaya',
      badges: [
        'Affiliated to the Council for the Indian School Certificate Examinations, New Delhi',
      ],
      primaryColor: '#1b4d3e',
      accentColor: '#c5a572',
      sidebarColor: '#14382d',
      loginBackgroundStyle: 'gradient',
      showPoweredBy: true,
      brandingEnabled: true,
      portalExtrasJson: { institutionType: 'SCHOOL' },
    },
  });

  const allPermissions = await prisma.permission.findMany();
  const bySlug = new Map(allPermissions.map((p) => [p.slug, p]));

  const upsertRole = async (
    slug: string,
    name: string,
    permissionSlugs: string[],
  ) => {
    const role = await prisma.role.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug } },
      update: { name },
      create: {
        tenantId: tenant.id,
        slug,
        name,
        isSystem: true,
      },
    });
    for (const permSlug of permissionSlugs) {
      const perm = bySlug.get(permSlug);
      if (!perm) continue;
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId: perm.id },
        },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      });
    }
    return role;
  };

  const adminRole = await upsertRole(
    'college-admin',
    'School Admin',
    ADMIN_PERMISSIONS,
  );
  await upsertRole('admission-admin', 'Admission Admin', ADMIN_PERMISSIONS);
  await upsertRole('applicant', 'Applicant', [
    'admissions:portal:self',
    'notifications:read',
  ]);

  const adminUser = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: 'admin@turapublicschool.com',
      },
    },
    update: { passwordHash: hash, isActive: true, displayName: 'TPS Admin' },
    create: {
      tenantId: tenant.id,
      email: 'admin@turapublicschool.com',
      passwordHash: hash,
      displayName: 'TPS Admin',
      emailVerifiedAt: new Date(),
      isActive: true,
    },
  });

  const existingAdminRole = await prisma.userRole.findFirst({
    where: { userId: adminUser.id, roleId: adminRole.id, deletedAt: null },
  });
  if (!existingAdminRole) {
    await prisma.userRole.create({
      data: { userId: adminUser.id, roleId: adminRole.id },
    });
  }

  let institution = await prisma.institution.findFirst({
    where: { tenantId: tenant.id, deletedAt: null },
  });
  if (!institution) {
    institution = await prisma.institution.create({
      data: {
        tenantId: tenant.id,
        name: 'Tura Public School',
        code: 'TPS',
      },
    });
  }

  await prisma.institutionAcademicConfig.upsert({
    where: { institutionId: institution.id },
    update: {
      programmeModel: 'SCHOOL',
      structureType: 'SCHOOL_CLASS',
    },
    create: {
      tenantId: tenant.id,
      institutionId: institution.id,
      programmeModel: 'SCHOOL',
      structureType: 'SCHOOL_CLASS',
      maxActiveSemesters: 1,
      operationalYears: 1,
    },
  });

  let campus = await prisma.campus.findFirst({
    where: {
      tenantId: tenant.id,
      institutionId: institution.id,
      deletedAt: null,
    },
  });
  if (!campus) {
    campus = await prisma.campus.create({
      data: {
        tenantId: tenant.id,
        institutionId: institution.id,
        name: 'Tura Campus',
        code: 'TURA',
      },
    });
  }

  let academicYear = await prisma.academicYear.findFirst({
    where: {
      tenantId: tenant.id,
      institutionId: institution.id,
      name: 'Session 2027',
      deletedAt: null,
    },
  });
  if (!academicYear) {
    academicYear = await prisma.academicYear.create({
      data: {
        tenantId: tenant.id,
        institutionId: institution.id,
        name: 'Session 2027',
        startDate: new Date('2027-01-01'),
        endDate: new Date('2027-12-31'),
        status: 'UPCOMING',
        isPrimarySession: true,
      },
    });
  }

  const program = await prisma.program.upsert({
    where: {
      tenantId_code: { tenantId: tenant.id, code: 'KG' },
    },
    update: { name: 'Kindergarten', level: 'SCHOOL' },
    create: {
      tenantId: tenant.id,
      code: 'KG',
      name: 'Kindergarten',
      level: 'SCHOOL',
    },
  });

  const start = new Date();
  const expiry = new Date(start);
  expiry.setFullYear(expiry.getFullYear() + 1);
  await prisma.tenantLicense.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      licenseNumber: 'BCL-2026-TPS-0001',
      licenseType: 'ANNUAL_1Y',
      subscriptionPlan: 'School Admissions',
      startDate: start,
      expiryDate: expiry,
      gracePeriodDays: 15,
      maxStudents: 2000,
      maxStaff: 200,
      storageLimitMb: 5120,
      createdById: adminUser.id,
    },
  });

  let cycle = await prisma.admissionCycle.findFirst({
    where: { tenantId: tenant.id, code: 'TPS-KG-2027', deletedAt: null },
  });
  if (!cycle) {
    cycle = await prisma.admissionCycle.create({
      data: {
        tenantId: tenant.id,
        institutionId: institution.id,
        academicYearId: academicYear.id,
        code: 'TPS-KG-2027',
        title: 'K.G. Admission Form for Academic Session 2027',
        status: 'OPEN',
        fyupSemester: 1,
        registrationOpensAt: new Date('2026-01-01'),
        registrationClosesAt: new Date('2026-09-25T23:59:59.000Z'),
        applicationDeadline: new Date('2026-09-25T23:59:59.000Z'),
        paymentDeadline: new Date('2026-09-25T23:59:59.000Z'),
        settings: settings as unknown as Prisma.InputJsonValue,
      },
    });
  } else {
    cycle = await prisma.admissionCycle.update({
      where: { id: cycle.id },
      data: {
        status: 'OPEN',
        title: 'K.G. Admission Form for Academic Session 2027',
        settings: settings as unknown as Prisma.InputJsonValue,
      },
    });
  }

  await prisma.admissionCycleProgram.upsert({
    where: {
      cycleId_programId: { cycleId: cycle.id, programId: program.id },
    },
    update: { enabled: true },
    create: {
      tenantId: tenant.id,
      cycleId: cycle.id,
      programId: program.id,
      enabled: true,
    },
  });

  const existingIntake = await prisma.admissionIntake.findFirst({
    where: { tenantId: tenant.id, code: 'KG-2027', deletedAt: null },
  });
  if (!existingIntake) {
    await prisma.admissionIntake.create({
      data: {
        tenantId: tenant.id,
        cycleId: cycle.id,
        programId: program.id,
        academicYearId: academicYear.id,
        name: 'K.G. 2027',
        code: 'KG-2027',
        totalSeats: 60,
        status: 'open',
      },
    });
  }

  return {
    tenantId: tenant.id,
    adminEmail: 'admin@turapublicschool.com',
    hosts: TPS_HOSTS,
  };
}
