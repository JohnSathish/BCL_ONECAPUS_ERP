'use client';

import { useQuery } from '@tanstack/react-query';
import { AlumniPublicShell } from '@/components/alumni-portal/alumni-public-shell';
import { fetchAlumniPortalInfo } from '@/services/alumni-portal';

export default function AlumniContactPage() {
  const infoQ = useQuery({ queryKey: ['alumni-portal-info'], queryFn: fetchAlumniPortalInfo });
  const s = infoQ.data?.settings;

  return (
    <AlumniPublicShell>
      <section className="border-b border-[#1a2b47]/10 bg-[#1a2b47]">
        <div className="mx-auto max-w-6xl px-4 py-14 lg:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f3b63b]">
            Reach us
          </p>
          <h1 className="mt-2 font-serif text-4xl text-white">Contact</h1>
        </div>
      </section>
      <div className="mx-auto max-w-3xl px-4 py-14 lg:px-6">
        <div className="rounded-2xl border border-[#1a2b47]/10 bg-white p-6 shadow-sm">
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-[#f3b63b]">Email</dt>
              <dd className="mt-1 text-[#1a2b47]">
                {s?.contactEmail || 'alumni@donboscocollege.ac.in'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-[#f3b63b]">Phone</dt>
              <dd className="mt-1 text-[#1a2b47]">{s?.contactPhone || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-[#f3b63b]">Address</dt>
              <dd className="mt-1 text-[#1a2b47]">
                {s?.address || 'Don Bosco College, Tura, Meghalaya, India'}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </AlumniPublicShell>
  );
}
