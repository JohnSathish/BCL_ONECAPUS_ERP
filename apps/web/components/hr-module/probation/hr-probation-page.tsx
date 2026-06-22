'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GlassCard } from '@/components/erp/glass-card';
import { Button } from '@/components/ui/button';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  confirmProbation,
  fetchProbationDashboard,
  fetchProbationStaff,
} from '@/services/hr-appointment';

export function HrProbationPage() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();

  const dashQ = useQuery({
    queryKey: ['hr', 'probation', 'dashboard'],
    queryFn: fetchProbationDashboard,
    enabled,
  });
  const staffQ = useQuery({
    queryKey: ['hr', 'probation', 'list'],
    queryFn: () => fetchProbationStaff(30),
    enabled,
  });

  const confirmMut = useMutation({
    mutationFn: (id: string) => confirmProbation(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['hr', 'probation'] });
    },
  });

  const dash = dashQ.data as Record<string, number> | undefined;
  const staff = staffQ.data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Probation Management</h2>
        <p className="text-sm text-muted-foreground">
          Staff nearing probation end — reminders sent at 30, 15, and 7 days.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { key: 'due30', label: 'Due in 30 days' },
          { key: 'due15', label: 'Due in 15 days' },
          { key: 'due7', label: 'Due in 7 days' },
          { key: 'onProbation', label: 'On Probation' },
          { key: 'confirmed', label: 'Confirmed' },
        ].map((k) => (
          <GlassCard key={k.key} className="p-4">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className="text-2xl font-bold">{dash?.[k.key] ?? '—'}</p>
          </GlassCard>
        ))}
      </div>

      <GlassCard className="overflow-hidden">
        <div className="border-b px-4 py-3 font-medium">Nearing Probation End</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <th className="px-4 py-2">Staff</th>
              <th className="px-4 py-2">Department</th>
              <th className="px-4 py-2">Probation Ends</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id} className="border-b">
                <td className="px-4 py-2">
                  <Link href={`/admin/staff/${s.id}`} className="hover:underline">
                    {s.fullName}
                  </Link>
                  <span className="ml-2 text-xs text-muted-foreground">{s.employeeCode}</span>
                </td>
                <td className="px-4 py-2">{s.department?.name ?? '—'}</td>
                <td className="px-4 py-2">
                  {s.probationEndDate
                    ? new Date(s.probationEndDate).toLocaleDateString('en-IN')
                    : '—'}
                </td>
                <td className="px-4 py-2 text-right">
                  <Button size="sm" variant="outline" onClick={() => confirmMut.mutate(s.id)}>
                    Confirm Service
                  </Button>
                </td>
              </tr>
            ))}
            {!staff.length && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  No staff nearing probation end.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </GlassCard>
    </div>
  );
}
