'use strict';

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const email =
  String(process.env.ADMIN_EMAIL || '')
    .toLowerCase()
    .trim() || 'contact@basecodelabs.com';
const name = String(process.env.ADMIN_NAME || '').trim() || 'BaseCode Labs Admin';

prisma.user
  .upsert({
    where: { email },
    update: { role: 'SUPER_ADMIN', status: 'ACTIVE', name },
    create: { email, name, role: 'SUPER_ADMIN', status: 'ACTIVE' },
  })
  .then((user) => {
    console.log(`[BaseCode] admin ready: ${user.email}`);
  })
  .catch((err) => {
    console.error('[BaseCode] ensure-admin failed', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
