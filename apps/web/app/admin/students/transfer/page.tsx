'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { Button } from '@/components/ui/button';
import { DateInput } from '@/components/ui/date-input';
import { Input } from '@/components/ui/input';
import { todayIsoDate } from '@/utils/format-date';
import { useRequireAuth } from '@/hooks/use-auth';
import { useStudentPermissions } from '@/hooks/use-student-permissions';
import { createLifecycleEvent, fetchStudents } from '@/services/students';
import type { LifecycleEventType } from '@/types/students';
import { apiErrorMessage } from '@/utils/api-error';

const transferEvents: { type: LifecycleEventType; label: string; description: string }[] = [
  {
    type: 'LEAVING',
    label: 'Leaving',
    description: 'Student is leaving mid-programme (TC workflow)',
  },
  {
    type: 'MIGRATION',
    label: 'Migration',
    description: 'Student migrating to another institution',
  },
];

export default function StudentTransferPage() {
  const session = useRequireAuth();
  const perms = useStudentPermissions();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [eventType, setEventType] = useState<LifecycleEventType>('LEAVING');
  const [effectiveDate, setEffectiveDate] = useState(() => todayIsoDate());
  const [reason, setReason] = useState('');
  const [conduct, setConduct] = useState('Good');
  const [attendance, setAttendance] = useState('Satisfactory');
  const [feeClearance, setFeeClearance] = useState('All dues cleared');
  const [message, setMessage] = useState('');

  const students = useQuery({
    queryKey: ['students', 'transfer', search],
    queryFn: () => fetchStudents({ limit: 20, search: search || undefined }),
    enabled: Boolean(session) && search.length >= 2,
  });

  const selected = (students.data?.data ?? []).find((s) => s.id === selectedId);
  const activeEvent = transferEvents.find((e) => e.type === eventType)!;

  const submitMut = useMutation({
    mutationFn: () =>
      createLifecycleEvent({
        studentId: selectedId,
        eventType,
        effectiveDate,
        reason: reason || undefined,
        metadata: {
          conduct,
          attendance,
          fee_clearance: feeClearance,
          reason_for_leaving: eventType === 'MIGRATION' ? 'Migration' : reason || 'Transfer',
          industry: attendance,
        },
      }),
    onSuccess: () => {
      setMessage(`${activeEvent.label} event recorded. You can now issue a Transfer Certificate.`);
      void qc.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Transfer event failed')),
  });

  if (!session) return null;

  return (
    <DashboardShell role="admin" title="Student Transfer">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Record leaving or migration events. TC fields are stored for certificate auto-fill in the
          Generator.
        </p>

        {message ? (
          <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">{message}</p>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-2">
          <CompactCard>
            <CompactCardHeader
              title="Find student"
              description="Search by enrollment number or name"
            />
            <CompactCardBody className="space-y-3">
              <Input
                placeholder="Type at least 2 characters…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSelectedId('');
                }}
              />
              <ul className="divide-y divide-border rounded-md border border-border text-sm">
                {(students.data?.data ?? []).map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span>
                      {row.enrollmentNumber} — {row.fullName}
                    </span>
                    <button
                      type="button"
                      className="text-primary underline-offset-2 hover:underline"
                      onClick={() => setSelectedId(row.id)}
                    >
                      {selectedId === row.id ? 'Selected' : 'Select'}
                    </button>
                  </li>
                ))}
              </ul>
            </CompactCardBody>
          </CompactCard>

          <CompactCard>
            <CompactCardHeader
              title="Transfer / leaving event"
              description={
                selected
                  ? `${selected.enrollmentNumber} · ${selected.fullName}`
                  : 'Select a student first'
              }
            />
            <CompactCardBody className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {transferEvents.map((ev) => (
                  <Button
                    key={ev.type}
                    type="button"
                    size="sm"
                    variant={eventType === ev.type ? 'default' : 'outline'}
                    onClick={() => setEventType(ev.type)}
                  >
                    {ev.label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{activeEvent.description}</p>
              <DateInput value={effectiveDate} onChange={setEffectiveDate} />
              <Input
                placeholder="Reason (optional)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <Input
                placeholder="Conduct"
                value={conduct}
                onChange={(e) => setConduct(e.target.value)}
              />
              <Input
                placeholder="Attendance"
                value={attendance}
                onChange={(e) => setAttendance(e.target.value)}
              />
              <Input
                placeholder="Fee clearance"
                value={feeClearance}
                onChange={(e) => setFeeClearance(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={!selectedId || !perms.canManage || submitMut.isPending}
                  onClick={() => submitMut.mutate()}
                >
                  {submitMut.isPending ? 'Submitting…' : `Record ${activeEvent.label}`}
                </Button>
                {selectedId ? (
                  <Link
                    href={`/admin/certificates/generator?studentId=${selectedId}&category=TRANSFER`}
                  >
                    <Button type="button" variant="outline">
                      Issue Transfer Certificate
                    </Button>
                  </Link>
                ) : null}
              </div>
            </CompactCardBody>
          </CompactCard>
        </div>
      </div>
    </DashboardShell>
  );
}
