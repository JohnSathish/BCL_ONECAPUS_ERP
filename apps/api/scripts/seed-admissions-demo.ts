import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'demo' } });
  if (!tenant) throw new Error('demo tenant not found');

  const inst = await prisma.institution.findFirst({
    where: { tenantId: tenant.id, deletedAt: null },
  });
  const ay = await prisma.academicYear.findFirst({
    where: { tenantId: tenant.id, deletedAt: null },
    orderBy: { startDate: 'desc' },
  });
  const program = await prisma.program.findFirst({
    where: { tenantId: tenant.id, deletedAt: null },
  });
  const intake = await prisma.admissionIntake.findFirst({
    where: { tenantId: tenant.id, deletedAt: null },
  });

  if (!inst || !ay || !program) {
    throw new Error('Missing institution, academic year, or program');
  }

  let cycle = await prisma.admissionCycle.findFirst({
    where: { tenantId: tenant.id, code: 'ADM-2026-27' },
  });

  if (!cycle) {
    cycle = await prisma.admissionCycle.create({
      data: {
        tenantId: tenant.id,
        institutionId: inst.id,
        academicYearId: ay.id,
        code: 'ADM-2026-27',
        title: 'Admission 2026-27',
        status: 'OPEN',
        registrationOpensAt: new Date('2026-01-01'),
        registrationClosesAt: new Date('2026-08-31'),
        applicationDeadline: new Date('2026-07-31'),
        paymentDeadline: new Date('2026-08-15'),
        settings: {
          applicationNumberPrefix: 'DBCT26',
          applicationFee: 600,
          admissionFeeMin: 10500,
          helpDesk: {
            phone: '+91 9402152496 / +91 9566363655',
            email: 'principaldbct@gmail.com',
          },
        },
      },
    });

    await prisma.admissionCycleProgram.create({
      data: {
        tenantId: tenant.id,
        cycleId: cycle.id,
        programId: program.id,
        enabled: true,
      },
    });

    if (intake) {
      await prisma.admissionIntake.update({
        where: { id: intake.id },
        data: { cycleId: cycle.id },
      });
    }
  }

  await prisma.tenantDomain.upsert({
    where: { host: 'admissions.demo.localhost' },
    update: { tenantId: tenant.id, verified: true },
    create: {
      tenantId: tenant.id,
      host: 'admissions.demo.localhost',
      verified: true,
    },
  });

  const permSlugs = [
    'admissions:configure',
    'admissions:verify-documents',
    'admissions:publish-merit',
    'admissions:allocate',
    'admissions:enroll',
    'admissions:portal:self',
  ];

  for (const slug of permSlugs) {
    await prisma.permission.upsert({
      where: { slug },
      update: {},
      create: {
        slug,
        resource: slug.split(':')[0]!,
        action: slug.split(':').slice(1).join(':'),
        description: slug,
      },
    });
  }

  const applicantRole = await prisma.role.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: 'applicant' } },
    update: { name: 'Applicant' },
    create: {
      tenantId: tenant.id,
      slug: 'applicant',
      name: 'Applicant',
      isSystem: true,
    },
  });

  const portalPerm = await prisma.permission.findFirst({
    where: { slug: 'admissions:portal:self' },
  });
  if (portalPerm) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: applicantRole.id,
          permissionId: portalPerm.id,
        },
      },
      update: {},
      create: { roleId: applicantRole.id, permissionId: portalPerm.id },
    });
  }

  await prisma.communicationTemplate.upsert({
    where: {
      tenantId_code: { tenantId: tenant.id, code: 'APPLICANT_PASSWORD_RESET' },
    },
    create: {
      tenantId: tenant.id,
      code: 'APPLICANT_PASSWORD_RESET',
      name: 'Applicant Password Reset',
      category: 'ADMISSIONS',
      subject: 'Reset your admission portal password — {{institution_name}}',
      bodyHtml:
        '<p>Dear {{student_name}},</p><p>We received a request to reset the password for application <strong>{{application_number}}</strong>.</p><p><a href="{{reset_link}}">Click here to set a new password</a>. This link expires in {{expiry_minutes}} minutes.</p><p>If you did not request this, you can ignore this email.</p>',
      bodyText:
        'Dear {{student_name}}, reset your admission portal password for {{application_number}}: {{reset_link}} (expires in {{expiry_minutes}} minutes).',
      variables: [
        'student_name',
        'application_number',
        'reset_link',
        'expiry_minutes',
        'institution_name',
      ],
      channels: ['EMAIL'],
      isActive: true,
    },
    update: { isActive: true },
  });

  console.log('Admissions demo seeded:', cycle.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
