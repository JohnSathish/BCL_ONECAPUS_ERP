import type { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import {
  SCHOOL_SIS_PERMISSION_MANAGE,
  SCHOOL_SIS_PERMISSION_READ,
  SCHOOL_SIS_PRODUCT,
} from '../../src/modules/school-sis/school-sis.constants';
import {
  SCHOOL_MOBILE_DEFAULT_PASSWORD,
  SCHOOL_MOBILE_PERMISSION_MANAGE,
  SCHOOL_MOBILE_PERMISSION_PARENT,
  SCHOOL_MOBILE_PERMISSION_STAFF,
  SCHOOL_MOBILE_PERMISSION_STUDENT,
} from '../../src/modules/school-mobile/school-mobile.constants';
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
  SCHOOL_MOBILE_PERMISSION_MANAGE,
  SCHOOL_MOBILE_PERMISSION_STAFF,
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
  { code: 'LKG', name: 'LKG', sortOrder: 1 },
  { code: 'UKG', name: 'UKG', sortOrder: 2 },
  { code: 'I', name: 'Class I', sortOrder: 3 },
  { code: 'II', name: 'Class II', sortOrder: 4 },
  { code: 'III', name: 'Class III', sortOrder: 5 },
  { code: 'IV', name: 'Class IV', sortOrder: 6 },
  { code: 'V', name: 'Class V', sortOrder: 7 },
  { code: 'VI', name: 'Class VI', sortOrder: 8 },
  { code: 'VII', name: 'Class VII', sortOrder: 9 },
  { code: 'VIII', name: 'Class VIII', sortOrder: 10 },
  { code: 'IX', name: 'Class IX', sortOrder: 11 },
  { code: 'X', name: 'Class X', sortOrder: 12 },
  { code: 'XI', name: 'Class XI', sortOrder: 13 },
];

const SUBJECTS: { code: string; name: string; sortOrder: number }[] = [
  { code: 'ENG', name: 'English', sortOrder: 1 },
  { code: 'MAT', name: 'Mathematics', sortOrder: 2 },
  { code: 'MATHS', name: 'MATHS', sortOrder: 3 },
  { code: 'SCI', name: 'Science', sortOrder: 4 },
  { code: 'SST', name: 'Social Studies', sortOrder: 5 },
  { code: 'SS', name: 'S.S.', sortOrder: 6 },
  { code: 'EVS', name: 'EVS', sortOrder: 7 },
  { code: 'HEDU', name: 'H.Edu', sortOrder: 8 },
  { code: 'CSC', name: 'Computer', sortOrder: 9 },
  { code: 'SL', name: 'Second Language', sortOrder: 10 },
  { code: 'PE', name: 'Physical Education', sortOrder: 11 },
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
    {
      slug: SCHOOL_MOBILE_PERMISSION_STUDENT,
      resource: 'school-mobile',
      action: 'student',
      description: 'St. Luke’s School student mobile app',
    },
    {
      slug: SCHOOL_MOBILE_PERMISSION_PARENT,
      resource: 'school-mobile',
      action: 'parent',
      description: 'St. Luke’s School parent mobile app',
    },
    {
      slug: SCHOOL_MOBILE_PERMISSION_STAFF,
      resource: 'school-mobile',
      action: 'staff',
      description: 'St. Luke’s School staff mobile app',
    },
    {
      slug: SCHOOL_MOBILE_PERMISSION_MANAGE,
      resource: 'school-mobile',
      action: 'manage',
      description: 'Manage St. Luke’s School mobile app',
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
  const teacherRole = await upsertRole('teacher', 'Teacher', [
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_MOBILE_PERMISSION_STAFF,
  ]);
  const studentAppRole = await upsertRole('school-student', 'School Student', [
    SCHOOL_MOBILE_PERMISSION_STUDENT,
  ]);
  const parentAppRole = await upsertRole('school-parent', 'School Parent', [
    SCHOOL_MOBILE_PERMISSION_PARENT,
  ]);

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
  const mainType = await prisma.schoolSubjectType.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'MAIN' } },
    update: {
      name: 'Main Subject',
      sortOrder: 1,
      active: true,
      deletedAt: null,
    },
    create: {
      tenantId: tenant.id,
      code: 'MAIN',
      name: 'Main Subject',
      sortOrder: 1,
    },
  });
  await prisma.schoolSubjectType.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'OPTIONAL' } },
    update: {
      name: 'Optional Subject',
      sortOrder: 2,
      active: true,
      deletedAt: null,
    },
    create: {
      tenantId: tenant.id,
      code: 'OPTIONAL',
      name: 'Optional Subject',
      sortOrder: 2,
    },
  });
  for (const subject of SUBJECTS) {
    const row = await prisma.schoolSubject.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: subject.code } },
      update: {
        name: subject.name,
        sortOrder: subject.sortOrder,
        active: true,
        deletedAt: null,
        subjectTypeId: mainType.id,
      },
      create: {
        tenantId: tenant.id,
        code: subject.code,
        name: subject.name,
        sortOrder: subject.sortOrder,
        subjectTypeId: mainType.id,
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

  const classXi = await prisma.schoolGrade.findFirst({
    where: { tenantId: tenant.id, code: 'XI', deletedAt: null },
  });
  const sectionA = classXi
    ? await prisma.schoolSection.findFirst({
        where: {
          tenantId: tenant.id,
          academicYearId: academicYear.id,
          gradeId: classXi.id,
          name: 'A',
          deletedAt: null,
        },
      })
    : null;

  const student = await prisma.schoolStudent.upsert({
    where: {
      tenantId_admissionNumber: {
        tenantId: tenant.id,
        admissionNumber: 'SLS26-0001',
      },
    },
    update: { fullName: 'John Marak', status: 'ACTIVE', deletedAt: null },
    create: {
      tenantId: tenant.id,
      admissionNumber: 'SLS26-0001',
      fullName: 'John Marak',
      gender: 'MALE',
      status: 'ACTIVE',
    },
  });
  if (sectionA) {
    await prisma.schoolEnrollment.upsert({
      where: {
        tenantId_studentId_academicYearId: {
          tenantId: tenant.id,
          studentId: student.id,
          academicYearId: academicYear.id,
        },
      },
      update: {
        sectionId: sectionA.id,
        status: 'ACTIVE',
        deletedAt: null,
        rollNumber: 'SLS26-0001',
      },
      create: {
        tenantId: tenant.id,
        studentId: student.id,
        academicYearId: academicYear.id,
        sectionId: sectionA.id,
        rollNumber: 'SLS26-0001',
        status: 'ACTIVE',
      },
    });
  }
  let guardian = await prisma.schoolGuardian.findFirst({
    where: { tenantId: tenant.id, email: 'parent@stlukestura.in' },
  });
  if (!guardian) {
    guardian = await prisma.schoolGuardian.create({
      data: {
        tenantId: tenant.id,
        fullName: 'Mary Marak',
        relation: 'MOTHER',
        phone: '9862000001',
        email: 'parent@stlukestura.in',
        isPrimary: true,
      },
    });
  }
  await prisma.schoolStudentGuardian.upsert({
    where: {
      studentId_guardianId: { studentId: student.id, guardianId: guardian.id },
    },
    update: { relationship: 'MOTHER' },
    create: {
      studentId: student.id,
      guardianId: guardian.id,
      relationship: 'MOTHER',
    },
  });

  const ensureUser = async (
    email: string,
    displayName: string,
    roleId: string,
  ) => {
    const user = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email } },
      update: { isActive: true, displayName, emailVerifiedAt: new Date() },
      create: {
        tenantId: tenant.id,
        email,
        passwordHash: hash,
        displayName,
        emailVerifiedAt: new Date(),
        isActive: true,
      },
    });
    const linked = await prisma.userRole.findFirst({
      where: { userId: user.id, roleId, deletedAt: null },
    });
    if (!linked) {
      await prisma.userRole.create({ data: { userId: user.id, roleId } });
    }
    return user;
  };

  const studentDefaultHash = await bcrypt.hash(
    SCHOOL_MOBILE_DEFAULT_PASSWORD,
    12,
  );
  const studentUser = await ensureUser(
    'student@stlukestura.in',
    'John Marak',
    studentAppRole.id,
  );
  await prisma.user.update({
    where: { id: studentUser.id },
    data: {
      username: 'SLS26-0001',
      passwordHash: studentDefaultHash,
      mustResetPassword: true,
      isActive: true,
      displayName: 'John Marak',
    },
  });
  const parentUser = await ensureUser(
    'parent@stlukestura.in',
    'Mary Marak',
    parentAppRole.id,
  );
  const teacherUser = await ensureUser(
    'teacher@stlukestura.in',
    'Rita Sangma',
    teacherRole.id,
  );

  await prisma.schoolPersonAccount.upsert({
    where: {
      tenantId_userId_personType: {
        tenantId: tenant.id,
        userId: studentUser.id,
        personType: 'STUDENT',
      },
    },
    update: { studentId: student.id },
    create: {
      tenantId: tenant.id,
      userId: studentUser.id,
      personType: 'STUDENT',
      studentId: student.id,
    },
  });
  await prisma.schoolPersonAccount.upsert({
    where: {
      tenantId_userId_personType: {
        tenantId: tenant.id,
        userId: parentUser.id,
        personType: 'GUARDIAN',
      },
    },
    update: { guardianId: guardian.id },
    create: {
      tenantId: tenant.id,
      userId: parentUser.id,
      personType: 'GUARDIAN',
      guardianId: guardian.id,
    },
  });

  await prisma.schoolStaff.upsert({
    where: {
      tenantId_employeeCode: { tenantId: tenant.id, employeeCode: 'SLS-T-001' },
    },
    update: {
      email: teacherUser.email,
      fullName: 'Rita Sangma',
      deletedAt: null,
    },
    create: {
      tenantId: tenant.id,
      employeeCode: 'SLS-T-001',
      fullName: 'Rita Sangma',
      staffType: 'TEACHING',
      designation: 'Teacher',
      email: teacherUser.email,
    },
  });

  const prayerDays: Array<[number, string, string]> = [
    [
      1,
      'Monday morning prayer',
      'Lord, as we begin this week, fill our school with Your light. Amen.',
    ],
    [
      2,
      'Tuesday morning prayer',
      'God of wisdom, bless our classrooms today. Amen.',
    ],
    [
      3,
      'Wednesday morning prayer',
      'Heavenly Father, keep St. Luke’s in Your care. Amen.',
    ],
    [
      4,
      'Thursday morning prayer',
      'Lord Jesus, walk with us through this day. Amen.',
    ],
    [
      5,
      'Friday morning prayer',
      'God of peace, thank You for this week of learning. Amen.',
    ],
    [
      6,
      'Saturday prayer',
      'Creator God, we thank You for rest and family. Amen.',
    ],
    [7, 'Sunday prayer', 'Lord, we praise You on this holy day. Amen.'],
  ];
  for (const [weekday, title, body] of prayerDays) {
    await prisma.schoolMobilePrayer.upsert({
      where: { tenantId_weekday: { tenantId: tenant.id, weekday } },
      update: { title, body, enabled: true },
      create: {
        id: randomUUID(),
        tenantId: tenant.id,
        weekday,
        title,
        body,
        enabled: true,
      },
    });
  }

  await prisma.schoolMobileSettings.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      id: randomUUID(),
      tenantId: tenant.id,
      androidLatestVersion: '1.0.0',
      iosLatestVersion: '1.0.0',
      minVersion: '1.0.0',
      extrasJson: {},
    },
  });

  return {
    tenantId: tenant.id,
    adminEmail: 'admin@stlukestura.in',
    hosts: SLS_HOSTS,
  };
}
