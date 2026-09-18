import { SiteFooter } from '@/components/public/site-footer';
import { SiteHeader } from '@/components/public/site-header';
import { VisitorBeacon } from '@/components/public/visitor-beacon';
import { CookieBanner } from '@/components/legal/cookie-banner';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const totals = await prisma.visitorDay
    .aggregate({ _sum: { uniqueVisitors: true } })
    .catch(() => ({ _sum: { uniqueVisitors: 0 } }));
  return (
    <>
      <VisitorBeacon />
      <CookieBanner />
      <SiteHeader />
      {children}
      <SiteFooter visitors={totals._sum.uniqueVisitors ?? 0} />
    </>
  );
}
