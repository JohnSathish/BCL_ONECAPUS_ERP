'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { PrincipalDeskShell } from '@/components/principal-desk/principal-desk-shell';
import { SaaSCard, SectionTitle } from '@/components/dashboard/command-center-ui';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchCommitteeList, fetchCommitteeMonitor } from '@/services/principal-desk';

export default function CommitteesPage() {
  const enabled = useAuthQueryEnabled();
  const { data: dash } = useQuery({
    queryKey: ['principal-desk', 'committees'],
    queryFn: fetchCommitteeMonitor,
    enabled,
  });
  const { data: list } = useQuery({
    queryKey: ['principal-desk', 'committees-list'],
    queryFn: fetchCommitteeList,
    enabled,
  });

  const committees = (list as { items?: Array<Record<string, unknown>> })?.items ?? [];

  return (
    <PrincipalDeskShell title="Committee Monitor" subtitle="Governance committees and compliance">
      <div className="mb-4 grid gap-4 sm:grid-cols-4">
        <SaaSCard>
          <p className="text-xs text-slate-500">Active Committees</p>
          <p className="text-2xl font-black">{dash?.activeCommittees ?? 0}</p>
        </SaaSCard>
        <SaaSCard>
          <p className="text-xs text-slate-500">Scheduled Meetings</p>
          <p className="text-2xl font-black">{dash?.scheduledMeetings ?? 0}</p>
        </SaaSCard>
        <SaaSCard>
          <p className="text-xs text-slate-500">Pending ATR</p>
          <p className="text-2xl font-black text-amber-600">{dash?.pendingAtr ?? 0}</p>
        </SaaSCard>
        <SaaSCard>
          <p className="text-xs text-slate-500">Open Tasks</p>
          <p className="text-2xl font-black">{dash?.openTasks ?? 0}</p>
        </SaaSCard>
      </div>
      <SaaSCard>
        <SectionTitle title="All Committees" />
        <ul className="divide-y">
          {committees.map((c) => (
            <li key={String(c.id)} className="flex items-center justify-between py-3 text-sm">
              <div>
                <p className="font-semibold">{String(c.name)}</p>
                <p className="text-xs text-slate-500">{String(c.shortCode ?? c.category ?? '')}</p>
              </div>
              <Link
                href={`/admin/governance/committees/${String(c.id)}`}
                className="text-xs font-semibold text-indigo-600"
              >
                Open
              </Link>
            </li>
          ))}
        </ul>
      </SaaSCard>
    </PrincipalDeskShell>
  );
}
