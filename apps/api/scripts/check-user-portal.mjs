import { PrismaClient } from '@prisma/client';

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/check-user-portal.mjs <email>');
  process.exit(1);
}

const prisma = new PrismaClient();
const user = await prisma.user.findFirst({
  where: { email: { equals: email, mode: 'insensitive' } },
  include: {
    roles: {
      include: {
        role: {
          include: {
            permissions: { include: { permission: true } },
          },
        },
      },
    },
    student: {
      select: {
        id: true,
        enrollmentNumber: true,
        rollNumber: true,
        deletedAt: true,
      },
    },
    staffProfile: { select: { id: true, fullName: true } },
  },
});

if (!user) {
  console.log('User not found:', email);
  await prisma.$disconnect();
  process.exit(0);
}

const roles = user.roles.map((ur) => ur.role.slug);
const permissions = [
  ...new Set(
    user.roles.flatMap((ur) =>
      ur.role.permissions.map((rp) => rp.permission.slug),
    ),
  ),
];

console.log({
  email: user.email,
  isActive: user.isActive,
  roles,
  permissions: permissions.slice(0, 25),
  permissionCount: permissions.length,
  hasStudentRecord: Boolean(user.student && !user.student.deletedAt),
  student: user.student,
  staff: user.staffProfile,
});

await prisma.$disconnect();
