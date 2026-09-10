import type { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  SCHOOL_SIS_PERMISSION_MANAGE,
  SCHOOL_SIS_PERMISSION_READ,
  SCHOOL_SIS_PRODUCT,
} from '../../src/modules/school-sis/school-sis.constants';
import {
  SCHOOL_WEB_PERMISSION_ENQUIRIES,
  SCHOOL_WEB_PERMISSION_MANAGE,
  SCHOOL_WEB_PERMISSION_MEDIA,
  SCHOOL_WEB_PERMISSION_PUBLISH,
  SCHOOL_WEB_PERMISSION_READ,
} from '../../src/modules/school-web/school-web.constants';
import {
  SCHOOL_WEB_PERMISSIONS,
  seedStLukesWebsite,
} from './seed-st-lukes-website';

const SLS_HOSTS = [
  'erp.stlukestura.in',
  'stlukestura.in',
  'www.stlukestura.in',
  'sls.localhost',
  'school.localhost',
] as const;

const ADMIN_PERMISSIONS = [
  SCHOOL_SIS_PERMISSION_READ,
  SCHOOL_SIS_PERMISSION_MANAGE,
  SCHOOL_WEB_PERMISSION_READ,
  SCHOOL_WEB_PERMISSION_MANAGE,
  SCHOOL_WEB_PERMISSION_PUBLISH,
  SCHOOL_WEB_PERMISSION_MEDIA,
  SCHOOL_WEB_PERMISSION_ENQUIRIES,
  'users:read',
  'users:manage',
  'org:read',
  'org:manage',
  'lookups:read',
  'reports:read',
  'notifications:read',
  'license:read',
  'tenant:read',
];

const GRADES: { code: string; name: string; sortOrder: number }[] = [
  { code: 'NURSERY', name: 'Nursery', sortOrder: 0 },
  { code: 'UKG', name: 'UKG', sortOrder: 1 },
  { code: 'I', name: 'Class I', sortOrder: 2 },
  { code: 'II', name: 'Class II', sortOrder: 3 },
  { code: 'III', name: 'Class III', sortOrder: 4 },
  { code: 'IV', name: 'Class IV', sortOrder: 5 },
  { code: 'V', name: 'Class V', sortOrder: 6 },
  { code: 'VI', name: 'Class VI', sortOrder: 7 },
  { code: 'VII', name: 'Class VII', sortOrder: 8 },
  { code: 'VIII', name: 'Class VIII', sortOrder: 9 },
  { code: 'IX', name: 'Class IX', sortOrder: 10 },
  { code: 'X', name: 'Class X', sortOrder: 11 },
  { code: 'XI', name: 'Class XI', sortOrder: 12 },
];

const SUBJECTS: { code: string; name: string; sortOrder: number }[] = [
  { code: 'ENG', name: 'English', sortOrder: 1 },
  { code: 'MAT', name: 'Mathematics', sortOrder: 2 },
  { code: 'SCI', name: 'Science', sortOrder: 3 },
  { code: 'SST', name: 'Social Studies', sortOrder: 4 },
  { code: 'SL', name: 'Second Language', sortOrder: 5 },
  { code: 'CSC', name: 'Computer', sortOrder: 6 },
  { code: 'PE', name: 'Physical Education', sortOrder: 7 },
];

export async function seedStLukesSecondarySchool(
  prisma: PrismaClient,
  passwordHash?: string,
) {
  const hash = passwordHash ?? (await bcrypt.hash('Admin@123', 12));

  for (const perm of [
    {
      slug: SCHOOL_SIS_PERMISSION_READ,
      resource: 'school-sis',
      action: 'read',
      description: 'View St. Luke’s / secondary school SIS',
    },
    {
      slug: SCHOOL_SIS_PERMISSION_MANAGE,
      resource: 'school-sis',
      action: 'manage',
      description: 'Manage St. Luke’s / secondary school SIS',
    },
    ...SCHOOL_WEB_PERMISSIONS,
  ]) {
    await prisma.permission.upsert({
      where: { slug: perm.slug },
      update: { description: perm.description },
      create: perm,
    });
  }

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'st-lukes-tura' },
    update: { name: "St. Luke's Secondary School", status: 'active' },
    create: {
      name: "St. Luke's Secondary School",
      slug: 'st-lukes-tura',
      status: 'active',
    },
  });

  for (const host of SLS_HOSTS) {
    await prisma.tenantDomain.upsert({
      where: { host },
      update: { tenantId: tenant.id, verified: true, deletedAt: null },
      create: { tenantId: tenant.id, host, verified: true },
    });
  }

  const extras = {
    institutionType: 'SCHOOL' as const,
    schoolProduct: SCHOOL_SIS_PRODUCT,
  };

  await prisma.tenantBranding.upsert({
    where: { tenantId: tenant.id },
    update: {
      displayName: "St. Luke's Secondary School, Tura",
      shortName: 'SLS Tura',
      campusName: 'Walbakgre, Tura, West Garo Hills, Meghalaya',
      portalSubtitle: 'School ERP — Academic Session 2026–27',
      productName: "St. Luke's School ERP",
      productTagline: 'Knowledge · Service · Light',
      poweredByText: 'Powered by BaseCode Labs Pvt. Ltd.',
      address: 'Walbakgre, Tura - 794101, West Garo Hills, Meghalaya',
      badges: ['Secondary School, Tura'],
      primaryColor: '#1a365d',
      accentColor: '#c5a572',
      sidebarColor: '#12263f',
      loginBackgroundStyle: 'gradient',
      showPoweredBy: true,
      brandingEnabled: true,
      logoUrl: '/school-sis/st-lukes-logo.png',
      faviconUrl: '/school-sis/st-lukes-logo.png',
      portalExtrasJson: extras,
    },
    create: {
      tenantId: tenant.id,
      displayName: "St. Luke's Secondary School, Tura",
      shortName: 'SLS Tura',
      campusName: 'Walbakgre, Tura, West Garo Hills, Meghalaya',
      portalSubtitle: 'School ERP — Academic Session 2026–27',
      productName: "St. Luke's School ERP",
      productTagline: 'Knowledge · Service · Light',
      poweredByText: 'Powered by BaseCode Labs Pvt. Ltd.',
      address: 'Walbakgre, Tura - 794101, West Garo Hills, Meghalaya',
      badges: ['Secondary School, Tura'],
      primaryColor: '#1a365d',
      accentColor: '#c5a572',
      sidebarColor: '#12263f',
      loginBackgroundStyle: 'gradient',
      showPoweredBy: true,
      brandingEnabled: true,
      logoUrl: '/school-sis/st-lukes-logo.png',
      faviconUrl: '/school-sis/st-lukes-logo.png',
      portalExtrasJson: extras,
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
      create: { tenantId: tenant.id, slug, name, isSystem: true },
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
  await upsertRole('principal', 'Principal', ADMIN_PERMISSIONS);
  await upsertRole('teacher', 'Teacher', [SCHOOL_SIS_PERMISSION_READ]);

  const adminUser = await prisma.user.upsert({
    where: {
      tenantId_email: { tenantId: tenant.id, email: 'admin@stlukestura.in' },
    },
    update: { isActive: true, displayName: "St. Luke's Admin" },
    create: {
      tenantId: tenant.id,
      email: 'admin@stlukestura.in',
      passwordHash: hash,
      displayName: "St. Luke's Admin",
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
        name: "St. Luke's Secondary School",
        code: 'SLS',
      },
    });
  }

  await prisma.institutionAcademicConfig.upsert({
    where: { institutionId: institution.id },
    update: { programmeModel: 'SCHOOL', structureType: 'SCHOOL_CLASS' },
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
        name: 'Walbakgre Campus',
        code: 'WALBAKGRE',
      },
    });
  }

  let academicYear = await prisma.schoolAcademicYear.findFirst({
    where: {
      tenantId: tenant.id,
      name: '2026-27',
      deletedAt: null,
    },
  });
  if (!academicYear) {
    academicYear = await prisma.schoolAcademicYear.create({
      data: {
        tenantId: tenant.id,
        name: '2026-27',
        code: '2026',
        startDate: new Date('2026-04-01'),
        endDate: new Date('2027-03-31'),
        status: 'CURRENT',
      },
    });
  } else if (academicYear.status !== 'CURRENT') {
    academicYear = await prisma.schoolAcademicYear.update({
      where: { id: academicYear.id },
      data: { status: 'CURRENT', deletedAt: null },
    });
  }

  const existingCycle = await prisma.schoolAdmissionCycle.findFirst({
    where: { tenantId: tenant.id, name: 'Admission 2026-27', deletedAt: null },
  });
  if (!existingCycle) {
    await prisma.schoolAdmissionCycle.create({
      data: {
        tenantId: tenant.id,
        academicYearId: academicYear.id,
        name: 'Admission 2026-27',
        opensAt: new Date('2026-04-01'),
        closesAt: new Date('2027-03-31'),
        status: 'OPEN',
      },
    });
  }

  const licenseStart = new Date('2026-04-01');
  const licenseExpiry = new Date('2027-03-31');
  await prisma.tenantLicense.upsert({
    where: { tenantId: tenant.id },
    update: { subscriptionPlan: 'School ERP' },
    create: {
      tenantId: tenant.id,
      licenseNumber: 'BCL-SLS-2026-0001',
      licenseType: 'ANNUAL_1Y',
      subscriptionPlan: 'School ERP',
      startDate: licenseStart,
      expiryDate: licenseExpiry,
      gracePeriodDays: 15,
      maxStudents: 1500,
      maxStaff: 120,
      storageLimitMb: 5120,
    },
  });

  const gradeIds: Record<string, string> = {};
  for (const grade of GRADES) {
    const row = await prisma.schoolGrade.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: grade.code } },
      update: {
        name: grade.name,
        sortOrder: grade.sortOrder,
        active: true,
        deletedAt: null,
      },
      create: {
        tenantId: tenant.id,
        code: grade.code,
        name: grade.name,
        sortOrder: grade.sortOrder,
      },
    });
    gradeIds[grade.code] = row.id;
  }

  const subjectIds: Record<string, string> = {};
  for (const subject of SUBJECTS) {
    const row = await prisma.schoolSubject.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: subject.code } },
      update: {
        name: subject.name,
        sortOrder: subject.sortOrder,
        active: true,
        deletedAt: null,
      },
      create: {
        tenantId: tenant.id,
        code: subject.code,
        name: subject.name,
        sortOrder: subject.sortOrder,
      },
    });
    subjectIds[subject.code] = row.id;
  }

  for (const grade of GRADES) {
    const gradeId = gradeIds[grade.code];
    if (!gradeId) continue;
    for (const subject of SUBJECTS) {
      const subjectId = subjectIds[subject.code];
      if (!subjectId) continue;
      await prisma.schoolGradeSubject.upsert({
        where: {
          tenantId_academicYearId_gradeId_subjectId: {
            tenantId: tenant.id,
            academicYearId: academicYear.id,
            gradeId,
            subjectId,
          },
        },
        update: {},
        create: {
          tenantId: tenant.id,
          academicYearId: academicYear.id,
          gradeId,
          subjectId,
        },
      });
    }

    await prisma.schoolSection.upsert({
      where: {
        tenantId_academicYearId_gradeId_name: {
          tenantId: tenant.id,
          academicYearId: academicYear.id,
          gradeId,
          name: 'A',
        },
      },
      update: { deletedAt: null },
      create: {
        tenantId: tenant.id,
        academicYearId: academicYear.id,
        gradeId,
        name: 'A',
        capacity: 40,
      },
    });
  }

  await seedStLukesWebsite(prisma, tenant.id);

  return {
    tenantId: tenant.id,
    adminEmail: 'admin@stlukestura.in',
    hosts: SLS_HOSTS,
  };
}
