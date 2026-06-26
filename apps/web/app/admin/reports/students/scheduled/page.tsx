'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Trash2 } from 'lucide-react';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { Button } from '@/components/ui/button';
import { StudentReportsShell } from '@/components/student-reports/student-reports-shell';
import {
  createScheduledReport,
  deleteScheduledReport,
  fetchSavedReports,
  fetchScheduledReports,
} from '@/services/student-reports';
import { apiErrorMessage } from '@/utils/api-error';

export default function ScheduledReportsPage() {
  const [name, setName] = useState('');
  const [savedReportId, setSavedReportId] = useState('');
  const [scheduleType, setScheduleType] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('WEEKLY');
  const [scheduleTime, setScheduleTime] = useState('08:00');
  const [message, setMessage] = useState('');
  const queryClient = useQueryClient();

  const savedQuery = useQuery({
    queryKey: ['saved-reports'],
    queryFn: () => fetchSavedReports(),
  });

  const scheduledQuery = useQuery({
    queryKey: ['scheduled-reports'],
    queryFn: () => fetchScheduledReports(),
  });

  const createMut = useMutation({
    mutationFn: () =>
      createScheduledReport({
        name: name.trim(),
        savedReportId,
        scheduleType,
        scheduleTime,
        scheduleDay: scheduleType === 'WEEKLY' ? 1 : scheduleType === 'MONTHLY' ? 1 : undefined,
        format: 'xlsx',
      }),
    onSuccess: () => {
      setMessage('Schedule saved. Automated delivery will run when the worker job ships.');
      setName('');
      queryClient.invalidateQueries({ queryKey: ['scheduled-reports'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Could not save schedule')),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteScheduledReport(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scheduled-reports'] }),
    onError: (e) => setMessage(apiErrorMessage(e, 'Delete failed')),
  });

  return (
    <DashboardShell title="Student Reports">
      <StudentReportsShell
        title="Scheduled Reports"
        description="Define recurring exports. Email delivery is queued for the next worker release."
      >
        <CompactCard>
          <CompactCardHeader title="New schedule" />
          <CompactCardBody className="grid gap-3 sm:grid-cols-2">
            <input
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="Schedule name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <select
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={savedReportId}
              onChange={(e) => setSavedReportId(e.target.value)}
            >
              <option value="">Select saved report…</option>
              {(savedQuery.data ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={scheduleType}
              onChange={(e) => setScheduleType(e.target.value as 'DAILY' | 'WEEKLY' | 'MONTHLY')}
            >
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly (Monday)</option>
              <option value="MONTHLY">Monthly (1st)</option>
            </select>
            <input
              type="time"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
            />
            <Button
              className="sm:col-span-2"
              size="sm"
              disabled={!name.trim() || !savedReportId || createMut.isPending}
              onClick={() => createMut.mutate()}
            >
              <CalendarClock className="mr-1 h-3.5 w-3.5" />
              Save schedule
            </Button>
            {message ? (
              <p className="sm:col-span-2 text-sm text-muted-foreground">{message}</p>
            ) : null}
          </CompactCardBody>
        </CompactCard>

        <CompactCard>
          <CompactCardHeader title="Active schedules" />
          <CompactCardBody className="space-y-2">
            {(scheduledQuery.data ?? []).map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">{row.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.scheduleType} at {row.scheduleTime ?? '08:00'} ·{' '}
                    {row.savedReport?.name ?? 'Report'} · next{' '}
                    {row.nextRunAt ? row.nextRunAt.slice(0, 16).replace('T', ' ') : '—'}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive"
                  onClick={() => deleteMut.mutate(row.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {!scheduledQuery.data?.length && !scheduledQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">No schedules yet.</p>
            ) : null}
          </CompactCardBody>
        </CompactCard>
      </StudentReportsShell>
    </DashboardShell>
  );
}
