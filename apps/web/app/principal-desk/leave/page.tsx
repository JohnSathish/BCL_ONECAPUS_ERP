'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PrincipalDeskShell } from '@/components/principal-desk/principal-desk-shell';
import { Button } from '@/components/ui/button';
import { SaaSCard, SectionTitle } from '@/components/dashboard/command-center-ui';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  approveStaffLeave,
  approveStudentLeave,
  fetchLeaveApplications,
} from '@/services/principal-desk';
import { cn } from '@/utils/cn';

export default function LeavePage() {
  const [tab, setTab] = useState<'all' | 'staff' | 'student'>('all');
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['principal-desk', 'leave', tab],
    queryFn: () => fetchLeaveApplications(tab),
    enabled,
  });

  const staffApprove = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'APPROVE' | 'REJECT' }) =>
      approveStaffLeave(id, action),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['principal-desk', 'leave'] }),
  });

  const studentApprove = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'APPROVE' | 'REJECT' }) =>
      approveStudentLeave(id, action),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['principal-desk', 'leave'] }),
  });

  const staffRows = (data?.staff ?? []) as Array<Record<string, unknown>>;
  const studentRows = (data?.student ?? []) as Array<Record<string, unknown>>;

  return (
    <PrincipalDeskShell
      title="Leave Approval Center"
      subtitle="Approve staff and student leave requests"
    >
      <div className="mb-4 flex gap-2">
        {(['all', 'staff', 'student'] as const).map((t) => (
          <Button
            key={t}
            size="sm"
            variant={tab === t ? 'default' : 'outline'}
            onClick={() => setTab(t)}
          >
            {t === 'all' ? 'All' : t === 'staff' ? 'Staff' : 'Student'}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
      ) : (
        <div className="space-y-6">
          {tab !== 'student' && (
            <SaaSCard>
              <SectionTitle title="Staff Leave Requests" subtitle={`${staffRows.length} pending`} />
              {staffRows.length === 0 ? (
                <p className="text-sm text-slate-500">No pending staff leave</p>
              ) : (
                <ul className="space-y-3">
                  {staffRows.map((row) => (
                    <LeaveRow
                      key={String(row.id)}
                      title={String(
                        (row.staffProfile as { fullName?: string })?.fullName ?? 'Staff',
                      )}
                      meta={`${String(row.fromDate).slice(0, 10)} → ${String(row.toDate).slice(0, 10)}`}
                      onApprove={() =>
                        staffApprove.mutate({ id: String(row.id), action: 'APPROVE' })
                      }
                      onReject={() => staffApprove.mutate({ id: String(row.id), action: 'REJECT' })}
                    />
                  ))}
                </ul>
              )}
            </SaaSCard>
          )}

          {tab !== 'staff' && (
            <SaaSCard>
              <SectionTitle
                title="Student Leave Requests"
                subtitle={`${studentRows.length} pending`}
              />
              {studentRows.length === 0 ? (
                <p className="text-sm text-slate-500">No pending student leave</p>
              ) : (
                <ul className="space-y-3">
                  {studentRows.map((row) => (
                    <LeaveRow
                      key={String(row.id)}
                      title={String(
                        (row.student as { masterProfile?: { fullName?: string } })?.masterProfile
                          ?.fullName ?? 'Student',
                      )}
                      meta={`${String(row.fromDate).slice(0, 10)} → ${String(row.toDate).slice(0, 10)} · ${String((row.leaveType as { name?: string })?.name ?? '')}`}
                      urgent={isUrgent(String(row.fromDate))}
                      onApprove={() =>
                        studentApprove.mutate({ id: String(row.id), action: 'APPROVE' })
                      }
                      onReject={() =>
                        studentApprove.mutate({ id: String(row.id), action: 'REJECT' })
                      }
                    />
                  ))}
                </ul>
              )}
            </SaaSCard>
          )}
        </div>
      )}
    </PrincipalDeskShell>
  );
}

function isUrgent(fromDate: string) {
  const start = new Date(fromDate).getTime();
  const now = Date.now();
  return start - now < 48 * 3600 * 1000;
}

function LeaveRow({
  title,
  meta,
  urgent,
  onApprove,
  onReject,
}: {
  title: string;
  meta: string;
  urgent?: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <li
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3',
        urgent && 'border-amber-300 bg-amber-50/60',
      )}
    >
      <div>
        <p className="font-semibold text-slate-900">{title}</p>
        <p className="text-xs text-slate-500">{meta}</p>
        {urgent && <p className="text-xs font-semibold text-amber-700">Starts within 48h</p>}
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={onApprove}>
          Approve
        </Button>
        <Button size="sm" variant="outline" onClick={onReject}>
          Reject
        </Button>
      </div>
    </li>
  );
}
