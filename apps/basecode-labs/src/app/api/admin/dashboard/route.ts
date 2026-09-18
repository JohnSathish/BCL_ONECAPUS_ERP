import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaff } from '@/lib/staff';
import { visitorSummary } from '@/lib/visitors';

export async function GET() {
  const gate = await requireStaff();
  if (gate.error) return gate.error;
  const [clients, products, licenses, expiring, contracts, leads, tickets, visitors] =
    await Promise.all([
      prisma.client.count(),
      prisma.product.count(),
      prisma.license.count({ where: { status: 'ACTIVE' } }),
      prisma.license.count({
        where: {
          status: 'ACTIVE',
          expiryDate: { lte: new Date(Date.now() + 30 * 86400000), gte: new Date() },
        },
      }),
      prisma.contract.count({ where: { status: 'ACTIVE' } }),
      prisma.lead.count({ where: { stage: { not: 'LOST' } } }),
      prisma.supportTicket.count({ where: { status: { not: 'CLOSED' } } }),
      visitorSummary(),
    ]);
  const activity = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 12 });
  return NextResponse.json({
    cards: {
      clients,
      products,
      activeLicenses: licenses,
      expiringLicenses: expiring,
      activeContracts: contracts,
      openLeads: leads,
      openTickets: tickets,
      visitorsToday: visitors.todayUnique,
      visitorsAll: visitors.allUnique,
      pageViewsToday: visitors.todayViews,
    },
    visitors,
    activity,
  });
}
