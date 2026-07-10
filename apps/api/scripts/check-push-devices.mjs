import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();
const total = await p.mobileDevice.count();
const withToken = await p.mobileDevice.count({
  where: { pushToken: { not: null }, status: 'ACTIVE' },
});
const sample = await p.mobileDevice.findMany({
  where: { status: 'ACTIVE' },
  take: 8,
  orderBy: { updatedAt: 'desc' },
  select: {
    deviceId: true,
    platform: true,
    appType: true,
    status: true,
    updatedAt: true,
    pushToken: true,
  },
});
console.log(
  JSON.stringify(
    {
      total,
      withToken,
      samples: sample.map((s) => ({
        deviceId: s.deviceId,
        platform: s.platform,
        appType: s.appType,
        hasToken: Boolean(s.pushToken),
        tokenPrefix: s.pushToken
          ? `${String(s.pushToken).slice(0, 16)}...`
          : null,
        updatedAt: s.updatedAt,
      })),
    },
    null,
    2,
  ),
);
await p.$disconnect();
