import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function PortalHome() {
  const session = await readSession();
  if (!session) redirect('/portal/login');
  const client = session.user.clientId
    ? await prisma.client.findUnique({
        where: { id: session.user.clientId },
        include: { licenses: true, contracts: true, tickets: true, websites: true, apps: true },
      })
    : null;
  return (
    <main className="bcl-container py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
        Client portal
      </p>
      <h1 className="mt-1 text-2xl font-semibold text-slate-900">Welcome, {session.user.name}</h1>
      <p className="text-slate-600">{client?.organisation ?? 'Your BaseCode Labs services'}</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Active licenses', client?.licenses.filter((l) => l.status === 'ACTIVE').length ?? 0],
          ['Contracts', client?.contracts.length ?? 0],
          ['Open tickets', client?.tickets.filter((t) => t.status !== 'CLOSED').length ?? 0],
          ['Websites', client?.websites.length ?? 0],
        ].map(([label, value]) => (
          <div key={String(label)} className="bcl-card p-5">
            <div className="text-sm text-slate-500">{label}</div>
            <div className="text-3xl font-semibold">{value}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
