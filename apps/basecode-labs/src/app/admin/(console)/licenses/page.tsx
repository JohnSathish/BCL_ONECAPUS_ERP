import { LicenseDesk } from '@/components/admin/license-desk';
import { prisma } from '@/lib/prisma';

export default async function LicensesPage() {
  const [licenses, clients, products] = await Promise.all([
    prisma.license.findMany({
      include: { client: true, product: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.client.findMany({ orderBy: { organisation: 'asc' } }),
    prisma.product.findMany({ orderBy: { name: 'asc' } }),
  ]);
  return (
    <LicenseDesk
      licenses={licenses.map((l) => ({
        id: l.id,
        licenseCode: l.licenseCode,
        licenseKey: l.licenseKey,
        status: l.status,
        licenseType: l.licenseType,
        startDate: l.startDate.toISOString(),
        expiryDate: l.expiryDate?.toISOString() ?? null,
        domainRestriction: l.domainRestriction,
        clientName: l.client.organisation,
        productName: l.product.name,
        productId: l.productId,
        activations: l.currentActivations,
        activationLimit: l.activationLimit,
        createdAt: l.createdAt.toISOString(),
      }))}
      clients={clients.map((c) => ({ id: c.id, name: c.organisation }))}
      products={products.map((p) => ({ id: p.id, name: p.name }))}
    />
  );
}
