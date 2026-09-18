import { prisma } from '@/lib/prisma';
import { ClientsDesk } from '@/components/admin/clients-desk';

export default async function ClientsPage() {
  const now = Date.now();
  const soon = now + 30 * 86400000;
  const clients = await prisma.client.findMany({
    include: { licenses: { select: { status: true, expiryDate: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return (
    <ClientsDesk
      clients={clients.map((c) => ({
        id: c.id,
        clientCode: c.clientCode,
        organisation: c.organisation,
        contactPerson: c.contactPerson,
        email: c.email,
        phone: c.phone,
        institutionType: c.institutionType,
        website: c.website,
        status: c.status,
        createdAt: c.createdAt.toISOString(),
        licenseCount: c.licenses.length,
        expiringSoon: c.licenses.filter((l) => {
          if (l.status !== 'ACTIVE' || !l.expiryDate) return false;
          const t = l.expiryDate.getTime();
          return t >= now && t <= soon;
        }).length,
      }))}
    />
  );
}
