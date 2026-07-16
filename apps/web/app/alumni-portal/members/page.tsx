'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlumniPublicShell } from '@/components/alumni-portal/alumni-public-shell';
import { Input } from '@/components/ui/input';
import { fetchAlumniDirectory } from '@/services/alumni-portal';

export default function AlumniMembersPage() {
  const [q, setQ] = useState('');
  const dirQ = useQuery({
    queryKey: ['alumni-directory', q],
    queryFn: () => fetchAlumniDirectory({ q: q || undefined }),
  });

  return (
    <AlumniPublicShell>
      <div className="mx-auto max-w-5xl px-4 py-14 lg:px-6">
        <h1 className="font-serif text-3xl text-[#1a2b47]">Alumni Directory</h1>
        <p className="mt-2 text-sm text-[#1a2b47]/75">
          Approved members who chose to appear in the public directory.
        </p>
        <Input
          className="mt-6 max-w-md"
          placeholder="Search by name, organisation, or role"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="mt-6 overflow-x-auto rounded-xl border border-[#1a2b47]/10 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-[#1a2b47]/5 text-left text-[#1a2b47]/70">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Year</th>
                <th className="px-4 py-3 font-medium">Department</th>
                <th className="px-4 py-3 font-medium">Profession</th>
              </tr>
            </thead>
            <tbody>
              {(dirQ.data ?? []).map((row) => (
                <tr key={row.id} className="border-b border-[#1a2b47]/08">
                  <td className="px-4 py-2.5 font-medium text-[#1a2b47]">{row.fullName}</td>
                  <td className="px-4 py-2.5">{row.graduationYear ?? '—'}</td>
                  <td className="px-4 py-2.5">{row.department ?? row.programme ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    {[row.currentRole, row.currentOrg].filter(Boolean).join(' · ') ||
                      row.occupation ||
                      '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!dirQ.isLoading && (dirQ.data?.length ?? 0) === 0 ? (
            <p className="p-6 text-sm text-[#1a2b47]/65">No directory profiles to show yet.</p>
          ) : null}
        </div>
      </div>
    </AlumniPublicShell>
  );
}
