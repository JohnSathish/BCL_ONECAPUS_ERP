import { cookies, headers } from 'next/headers';
import { prisma } from './prisma';

const VID = 'bcl_vid';

function today() {
  return new Date().toISOString().slice(0, 10);
}

export async function trackVisit(path: string) {
  if (path.startsWith('/admin') || path.startsWith('/portal') || path.startsWith('/api')) return;
  const jar = await cookies();
  let visitorId = jar.get(VID)?.value;
  if (!visitorId) {
    visitorId = crypto.randomUUID();
    jar.set(VID, visitorId, { path: '/', maxAge: 60 * 60 * 24 * 400, sameSite: 'lax' });
  }
  const h = await headers();
  const referrer = h.get('referer');
  const day = today();
  const uniqueKey = `seen:${day}:${visitorId}`;
  const already = await prisma.systemSetting.findUnique({ where: { key: uniqueKey } });
  await prisma.pageView.create({ data: { path, visitorId, referrer } });
  const existing = await prisma.visitorDay.findUnique({ where: { day } });
  if (!existing) {
    await prisma.visitorDay.create({
      data: { day, uniqueVisitors: 1, pageViews: 1 },
    });
  } else {
    await prisma.visitorDay.update({
      where: { day },
      data: {
        pageViews: { increment: 1 },
        uniqueVisitors: already ? existing.uniqueVisitors : { increment: 1 },
      },
    });
  }
  if (!already) {
    await prisma.systemSetting.create({ data: { key: uniqueKey, value: '1' } });
  }
}

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function fillVisitorDays(
  rows: { day: string; uniqueVisitors: number; pageViews: number }[],
  days: number,
) {
  const map = new Map(rows.map((r) => [r.day, r]));
  const out: { day: string; uniqueVisitors: number; pageViews: number }[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = isoDay(d);
    const row = map.get(key);
    out.push({
      day: key,
      uniqueVisitors: row?.uniqueVisitors ?? 0,
      pageViews: row?.pageViews ?? 0,
    });
  }
  return out;
}

export function classifyReferrer(referrer: string | null) {
  if (!referrer) return 'Direct';
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    if (host.includes('localhost') || host.includes('basecodelabs.com') || host.endsWith('.local'))
      return 'Direct';
    if (host.includes('google')) return 'Google';
    if (/facebook|instagram|linkedin|twitter|t\.co|youtube|whatsapp|telegram/.test(host))
      return 'Social';
    return 'Referral';
  } catch {
    return 'Other';
  }
}

export async function visitorSummary() {
  const day = today();
  const todayRow = await prisma.visitorDay.findUnique({ where: { day } });
  const totals = await prisma.visitorDay.aggregate({
    _sum: { uniqueVisitors: true, pageViews: true },
  });
  const last14 = await prisma.visitorDay.findMany({
    orderBy: { day: 'desc' },
    take: 14,
  });
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const views = await prisma.pageView.findMany({
    where: { createdAt: { gte: since } },
    select: { referrer: true },
  });
  const traffic: Record<string, number> = {
    Direct: 0,
    Google: 0,
    Referral: 0,
    Social: 0,
    Other: 0,
  };
  for (const v of views) {
    const bucket = classifyReferrer(v.referrer);
    traffic[bucket] = (traffic[bucket] ?? 0) + 1;
  }
  const trafficTotal = Object.values(traffic).reduce((a, b) => a + b, 0);
  return {
    todayUnique: todayRow?.uniqueVisitors ?? 0,
    todayViews: todayRow?.pageViews ?? 0,
    allUnique: totals._sum.uniqueVisitors ?? 0,
    allViews: totals._sum.pageViews ?? 0,
    series: last14.reverse(),
    last7: fillVisitorDays(last14, 7),
    traffic,
    trafficTotal,
  };
}
