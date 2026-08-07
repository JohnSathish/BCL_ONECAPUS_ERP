'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save } from 'lucide-react';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRequireAuth } from '@/hooks/use-auth';
import {
  fetchAttendancePolicy,
  updateAttendancePolicy,
  type AttendancePolicy,
} from '@/services/student-attendance';
import { apiErrorMessage } from '@/utils/api-error';

const MODE_HELP: Record<string, string> = {
  PERIOD_WISE:
    'Attendance is recorded for every scheduled teaching period. Reports use period counts.',
  EVERY_PERIOD:
    'Attendance is recorded for every scheduled teaching period. Reports use period counts.',
  ONCE_PER_DAY:
    'First-period faculty marks once per class for the day. That status counts for the whole working day. Later periods do not require marking.',
  MORNING_AFTERNOON:
    'Attendance is recorded twice per day — morning (before lunch) and afternoon (after lunch). Reports use session counts.',
  FIRST_LAST:
    'Legacy mode: only the first and last teaching periods of the day are marked and counted.',
};

type FormState = {
  attendanceMode: AttendancePolicy['attendanceMode'];
  shortageThresholdPct: number;
  defaulterThresholdPct: number;
  allowEditAfterSubmit: boolean;
  attendanceCutoffTime: string;
  lateGraceMinutes: string;
  latePolicy: 'NONE' | 'MARK_LATE';
  defaultAttendanceStatus: 'P' | 'A';
  weekendHolidayHandling: 'SKIP_NON_WORKING' | 'ALLOW_IF_GENERATED';
};

function toForm(policy: AttendancePolicy): FormState {
  return {
    attendanceMode: policy.attendanceMode,
    shortageThresholdPct: Number(policy.shortageThresholdPct ?? 75),
    defaulterThresholdPct: Number(policy.defaulterThresholdPct ?? 60),
    allowEditAfterSubmit: Boolean(policy.allowEditAfterSubmit),
    attendanceCutoffTime: policy.attendanceCutoffTime ?? '',
    lateGraceMinutes: policy.lateGraceMinutes == null ? '' : String(policy.lateGraceMinutes),
    latePolicy: policy.latePolicy === 'MARK_LATE' ? 'MARK_LATE' : 'NONE',
    defaultAttendanceStatus: policy.defaultAttendanceStatus === 'A' ? 'A' : 'P',
    weekendHolidayHandling:
      policy.weekendHolidayHandling === 'ALLOW_IF_GENERATED'
        ? 'ALLOW_IF_GENERATED'
        : 'SKIP_NON_WORKING',
  };
}

export default function AttendanceSettingsPage() {
  useRequireAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);
  const [message, setMessage] = useState('');

  const policyQ = useQuery({
    queryKey: ['student-attendance', 'policy'],
    queryFn: fetchAttendancePolicy,
  });

  useEffect(() => {
    if (policyQ.data) setForm(toForm(policyQ.data));
  }, [policyQ.data]);

  const saveMut = useMutation({
    mutationFn: (payload: Partial<AttendancePolicy>) => updateAttendancePolicy(payload),
    onSuccess: async (data) => {
      setForm(toForm(data));
      setMessage('Attendance settings saved.');
      await qc.invalidateQueries({ queryKey: ['student-attendance'] });
    },
    onError: (err) => setMessage(apiErrorMessage(err)),
  });

  const modeOptions: Array<{
    value: AttendancePolicy['attendanceMode'];
    label: string;
  }> = [
    { value: 'PERIOD_WISE', label: 'Period-wise Attendance' },
    { value: 'ONCE_PER_DAY', label: 'Once Per Day (First Period)' },
    { value: 'MORNING_AFTERNOON', label: 'Morning & Afternoon Sessions' },
  ];
  if (form?.attendanceMode === 'FIRST_LAST' || policyQ.data?.attendanceMode === 'FIRST_LAST') {
    modeOptions.push({
      value: 'FIRST_LAST',
      label: 'First & Last Period (legacy)',
    });
  }
  if (form?.attendanceMode === 'EVERY_PERIOD' || policyQ.data?.attendanceMode === 'EVERY_PERIOD') {
    modeOptions.unshift({
      value: 'EVERY_PERIOD',
      label: 'Every Period (legacy alias)',
    });
  }

  return (
    <DashboardShell
      title="Attendance Settings"
      subtitle="Institution-level student attendance collection mode and policies"
    >
      <div className="mb-3 text-sm text-muted-foreground">
        <Link
          href="/admin/academics/attendance"
          className="text-primary underline-offset-2 hover:underline"
        >
          Open Attendance Control Center
        </Link>
      </div>

      {policyQ.isLoading || !form ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading settings…
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <CompactCard>
            <CompactCardHeader title="Attendance collection mode" />
            <CompactCardBody className="space-y-3">
              <select
                className="h-10 w-full rounded-md border bg-card px-3 text-sm"
                value={form.attendanceMode}
                onChange={(e) =>
                  setForm((f) =>
                    f
                      ? {
                          ...f,
                          attendanceMode: e.target.value as AttendancePolicy['attendanceMode'],
                        }
                      : f,
                  )
                }
              >
                {modeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                {MODE_HELP[form.attendanceMode] ?? ''}
              </p>
              <p className="text-xs text-muted-foreground">
                Changing mode does not rewrite historical attendance marks. New session generation
                and percentage aggregation follow the selected mode (
                {policyQ.data?.unitLabels?.percentageHint ?? ''}).
              </p>
            </CompactCardBody>
          </CompactCard>

          <CompactCard>
            <CompactCardHeader title="Marking rules" />
            <CompactCardBody className="space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.allowEditAfterSubmit}
                  onChange={(e) =>
                    setForm((f) => (f ? { ...f, allowEditAfterSubmit: e.target.checked } : f))
                  }
                />
                Allow editing attendance after lock / final submission
              </label>
              <p className="text-xs text-muted-foreground">
                When off, faculty can keep updating during class (MARKED) but cannot change a LOCKED
                session. Admin corrections remain available.
              </p>

              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Attendance cutoff time (HH:mm, optional)
                </label>
                <Input
                  placeholder="e.g. 16:00"
                  value={form.attendanceCutoffTime}
                  onChange={(e) =>
                    setForm((f) => (f ? { ...f, attendanceCutoffTime: e.target.value } : f))
                  }
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Late attendance policy
                </label>
                <select
                  className="mt-1 h-10 w-full rounded-md border bg-card px-3 text-sm"
                  value={form.latePolicy}
                  onChange={(e) =>
                    setForm((f) =>
                      f
                        ? {
                            ...f,
                            latePolicy: e.target.value as 'NONE' | 'MARK_LATE',
                          }
                        : f,
                    )
                  }
                >
                  <option value="NONE">None</option>
                  <option value="MARK_LATE">Mark late (P → L after grace)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Late grace minutes
                </label>
                <Input
                  type="number"
                  min={0}
                  value={form.lateGraceMinutes}
                  onChange={(e) =>
                    setForm((f) => (f ? { ...f, lateGraceMinutes: e.target.value } : f))
                  }
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Default attendance status
                </label>
                <select
                  className="mt-1 h-10 w-full rounded-md border bg-card px-3 text-sm"
                  value={form.defaultAttendanceStatus}
                  onChange={(e) =>
                    setForm((f) =>
                      f
                        ? {
                            ...f,
                            defaultAttendanceStatus: e.target.value as 'P' | 'A',
                          }
                        : f,
                    )
                  }
                >
                  <option value="P">Present (P)</option>
                  <option value="A">Absent (A)</option>
                </select>
              </div>
            </CompactCardBody>
          </CompactCard>

          <CompactCard>
            <CompactCardHeader title="Working days & thresholds" />
            <CompactCardBody className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Weekend &amp; holiday handling
                </label>
                <select
                  className="mt-1 h-10 w-full rounded-md border bg-card px-3 text-sm"
                  value={form.weekendHolidayHandling}
                  onChange={(e) =>
                    setForm((f) =>
                      f
                        ? {
                            ...f,
                            weekendHolidayHandling: e.target
                              .value as FormState['weekendHolidayHandling'],
                          }
                        : f,
                    )
                  }
                >
                  <option value="SKIP_NON_WORKING">Skip non-working days (calendar)</option>
                  <option value="ALLOW_IF_GENERATED">
                    Allow generate even on non-working days
                  </option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Shortage threshold %
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={form.shortageThresholdPct}
                    onChange={(e) =>
                      setForm((f) =>
                        f
                          ? {
                              ...f,
                              shortageThresholdPct: Number(e.target.value),
                            }
                          : f,
                      )
                    }
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Defaulter threshold %
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={form.defaulterThresholdPct}
                    onChange={(e) =>
                      setForm((f) =>
                        f
                          ? {
                              ...f,
                              defaulterThresholdPct: Number(e.target.value),
                            }
                          : f,
                      )
                    }
                  />
                </div>
              </div>
            </CompactCardBody>
          </CompactCard>

          <div className="flex flex-col justify-end gap-3">
            {message ? (
              <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                {message}
              </p>
            ) : null}
            <Button
              type="button"
              disabled={saveMut.isPending}
              onClick={() =>
                saveMut.mutate({
                  attendanceMode: form.attendanceMode,
                  shortageThresholdPct: form.shortageThresholdPct,
                  defaulterThresholdPct: form.defaulterThresholdPct,
                  allowEditAfterSubmit: form.allowEditAfterSubmit,
                  attendanceCutoffTime: form.attendanceCutoffTime.trim() || null,
                  lateGraceMinutes:
                    form.lateGraceMinutes === '' ? null : Number(form.lateGraceMinutes),
                  latePolicy: form.latePolicy,
                  defaultAttendanceStatus: form.defaultAttendanceStatus,
                  weekendHolidayHandling: form.weekendHolidayHandling,
                })
              }
            >
              {saveMut.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save attendance settings
            </Button>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
