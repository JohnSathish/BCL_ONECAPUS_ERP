'use client';

import { useQuery } from '@tanstack/react-query';
import { PrincipalDeskShell } from '@/components/principal-desk/principal-desk-shell';
import { SaaSCard, SectionTitle, money } from '@/components/dashboard/command-center-ui';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchInstitutionalHealth } from '@/services/principal-desk';

export default function HealthPage() {
  const enabled = useAuthQueryEnabled();
  const { data, isLoading } = useQuery({
    queryKey: ['principal-desk', 'health'],
    queryFn: fetchInstitutionalHealth,
    enabled,
  });

  return (
    <PrincipalDeskShell title="Institutional Health" subtitle="One-page college health report">
      {isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
      ) : data ? (
        <div className="grid gap-4 md:grid-cols-2">
          <SaaSCard>
            <SectionTitle title="Students" />
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Stat label="Total" value={data.students.total} />
              <Stat label="Active" value={data.students.active} />
              <Stat label="Dropouts" value={data.students.dropouts} />
              <Stat label="Transfers" value={data.students.transfers} />
            </div>
          </SaaSCard>
          <SaaSCard>
            <SectionTitle title="Staff" />
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Stat label="Teaching" value={data.staff.teaching} />
              <Stat label="Non-Teaching" value={data.staff.nonTeaching} />
              <Stat label="Vacancies" value={data.staff.vacancies} />
            </div>
          </SaaSCard>
          <SaaSCard>
            <SectionTitle title="Finance" />
            <p className="text-sm">
              Collection: <strong>{money(data.finance.collection)}</strong>
            </p>
            <p className="text-sm">
              Outstanding:{' '}
              <strong className="text-rose-600">{money(data.finance.outstanding)}</strong>
            </p>
          </SaaSCard>
          <SaaSCard>
            <SectionTitle title="Library" />
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Stat label="Books Issued" value={data.library.booksIssued} />
              <Stat label="Overdue" value={data.library.overdueBooks} />
              <Stat label="Fine Collection" value={data.library.fineCollection} formatMoney />
            </div>
          </SaaSCard>
        </div>
      ) : null}
    </PrincipalDeskShell>
  );
}

function Stat({
  label,
  value,
  formatMoney,
}: {
  label: string;
  value: number;
  formatMoney?: boolean;
}) {
  return (
    <div>
      <p className="text-slate-500">{label}</p>
      <p className="text-xl font-bold">{formatMoney ? money(value) : value}</p>
    </div>
  );
}
