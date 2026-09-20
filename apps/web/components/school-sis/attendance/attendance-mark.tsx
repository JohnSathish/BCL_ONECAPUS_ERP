'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  fetchSchoolAcademicClasses,
  fetchSchoolAttendanceRoster,
  saveSchoolAttendanceDraft,
  submitSchoolAttendance,
  syncSchoolAttendance,
} from '@/services/school-sis';
import { apiErrorMessage } from '@/utils/api-error';
import { AttendanceShell, QUICK_STATUSES, STATUS_BTN, StatusChip } from './attendance-ui';
import { GhostButton, PrimaryButton } from '../academic/academic-ui';
import { cn } from '@/utils/cn';

const OFFLINE_KEY = 'sls-attendance-offline-queue';

function todayIso() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function loadQueue(): Array<Record<string, unknown>> {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveQueue(rows: Array<Record<string, unknown>>) {
  localStorage.setItem(OFFLINE_KEY, JSON.stringify(rows));
}

type StudentRow = {
  studentId: string;
  fullName: string;
  admissionNumber: string;
  rollNumber: string | null;
  photoUrl: string | null;
  status: string;
  remark: string | null;
  recordId: string | null;
  onApprovedLeave: boolean;
};

export function AttendanceMarkDesk() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const params = useSearchParams();
  const [date, setDate] = useState(params.get('date') || todayIso());
  const [sectionId, setSectionId] = useState(params.get('sectionId') || '');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<null | {
    original: Array<{ studentId: string; status: string }>;
    incoming: Array<{ studentId: string; status: string }>;
    sessionId: string;
  }>(null);
  const [offlineCount, setOfflineCount] = useState(0);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);

  const classes = useQuery({
    queryKey: ['school-academic-classes'],
    queryFn: fetchSchoolAcademicClasses,
    enabled,
  });
  const roster = useQuery({
    queryKey: ['school-att-roster', date, sectionId],
    queryFn: () => fetchSchoolAttendanceRoster({ date, sectionId }),
    enabled: enabled && !!sectionId,
  });

  useEffect(() => {
    if (roster.data?.students) setRows(roster.data.students);
  }, [roster.data]);

  useEffect(() => {
    setOfflineCount(loadQueue().length);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  useEffect(() => {
    if (!online) return;
    const queue = loadQueue();
    if (!queue.length) return;
    syncSchoolAttendance({ deviceId: 'web', sessions: queue })
      .then(() => {
        saveQueue([]);
        setOfflineCount(0);
        qc.invalidateQueries({ queryKey: ['school-att-roster'] });
      })
      .catch(() => undefined);
  }, [online, qc]);

  const counts = useMemo(() => {
    const c = { PRESENT: 0, ABSENT: 0, LATE: 0, LEAVE: 0, HALF_DAY: 0, EXCUSED: 0 };
    for (const r of rows) {
      if (r.status in c) (c as Record<string, number>)[r.status] += 1;
    }
    return c;
  }, [rows]);

  const filtered = rows.filter(
    (r) =>
      !q ||
      r.fullName.toLowerCase().includes(q.toLowerCase()) ||
      r.admissionNumber.toLowerCase().includes(q.toLowerCase()) ||
      (r.rollNumber ?? '').includes(q),
  );

  function payload(asDraft: boolean) {
    return {
      academicYearId: roster.data?.academicYear?.id,
      date,
      sectionId,
      mode: 'DAILY',
      periodKey: 'DAILY',
      asDraft,
      source: 'MANUAL',
      clientSessionId: `${sectionId}:${date}:DAILY`,
      baseVersion: roster.data?.session?.version,
      records: rows.map((r) => ({
        studentId: r.studentId,
        statusCode: r.status,
        remark: r.remark || undefined,
        clientRecordId: `${sectionId}:${date}:${r.studentId}`,
      })),
    };
  }

  const save = useMutation({
    mutationFn: async (asDraft: boolean) => {
      setError(null);
      setConflict(null);
      if (!navigator.onLine) {
        const queue = loadQueue().filter((x) => x.clientSessionId !== `${sectionId}:${date}:DAILY`);
        queue.push(payload(asDraft));
        saveQueue(queue);
        setOfflineCount(queue.length);
        return { offline: true };
      }
      const fn = asDraft ? saveSchoolAttendanceDraft : submitSchoolAttendance;
      return fn(payload(asDraft));
    },
    onSuccess: (data) => {
      if (data?.conflict) {
        setConflict(data);
        return;
      }
      qc.invalidateQueries({ queryKey: ['school-att-roster'] });
      qc.invalidateQueries({ queryKey: ['school-att-dash'] });
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  function setAll(code: string) {
    setRows((prev) => prev.map((r) => ({ ...r, status: code })));
  }

  const locked = roster.data?.session?.status === 'LOCKED' || roster.data?.canEdit === false;

  return (
    <AttendanceShell
      title={roster.data?.section?.name ?? 'Take attendance'}
      subtitle={
        roster.data
          ? `${roster.data.date} · ${rows.length} students · ${roster.data.session?.status ?? 'Not started'}`
          : 'Select class and date'
      }
    >
      {!online ? (
        <p className="rounded-xl bg-slate-800 px-4 py-2 text-sm text-white">
          OFFLINE{offlineCount ? ` · ${offlineCount} attendance records pending sync` : ''}
        </p>
      ) : offlineCount ? (
        <p className="rounded-xl bg-sky-50 px-4 py-2 text-sm text-sky-900">
          SYNCING pending attendance…
        </p>
      ) : null}
      {roster.data?.holidayBlocked ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm">
          This date is {roster.data.dayKind.replaceAll('_', ' ')}. Attendance is not required.
        </p>
      ) : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {conflict ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="font-semibold">Attendance conflict detected.</p>
          <p className="mt-1 text-slate-600">
            This class was changed on another device. Review and submit again to resolve, or request
            a correction. An audit record is kept for every change.
          </p>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
        />
        <select
          value={sectionId}
          onChange={(e) => setSectionId(e.target.value)}
          className="h-10 min-w-[12rem] rounded-lg border border-slate-200 px-3 text-sm"
        >
          <option value="">Select class / section</option>
          {(classes.data?.sections ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.grade.name} {s.name}
            </option>
          ))}
        </select>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, admission, roll"
          className="h-10 min-w-[12rem] flex-1 rounded-lg border border-slate-200 px-3 text-sm"
        />
      </div>
      {sectionId ? (
        <>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="sls-pill is-ok">Present {counts.PRESENT}</span>
            <span className="sls-pill is-warn">Absent {counts.ABSENT}</span>
            <span className="sls-pill is-amber">Late {counts.LATE}</span>
            <span className="sls-pill is-muted">Leave {counts.LEAVE}</span>
            {roster.data?.session ? (
              <StatusChip code={roster.data.session.status} />
            ) : (
              <StatusChip code="DRAFT" />
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <PrimaryButton type="button" disabled={locked} onClick={() => setAll('PRESENT')}>
              Mark all present
            </PrimaryButton>
            <GhostButton type="button" disabled={locked} onClick={() => setAll('ABSENT')}>
              Mark all absent
            </GhostButton>
            <GhostButton
              type="button"
              disabled={locked}
              onClick={() => roster.data?.students && setRows(roster.data.students)}
            >
              Reset
            </GhostButton>
          </div>
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white md:block">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Student</th>
                  <th className="px-3 py-2">Roll</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Remark</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.studentId} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      <p className="font-medium">{r.fullName}</p>
                      <p className="text-xs text-slate-500">{r.admissionNumber}</p>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{r.rollNumber ?? '—'}</td>
                    <td className="px-3 py-2">
                      <div
                        className="flex flex-wrap gap-1"
                        role="group"
                        aria-label={`Attendance for ${r.fullName}`}
                      >
                        {QUICK_STATUSES.map((code) => (
                          <button
                            key={code}
                            type="button"
                            disabled={locked}
                            aria-pressed={r.status === code}
                            onClick={() =>
                              setRows((prev) =>
                                prev.map((x) =>
                                  x.studentId === r.studentId ? { ...x, status: code } : x,
                                ),
                              )
                            }
                            className={cn(
                              'sls-status-chip',
                              r.status === code && (STATUS_BTN[code] ?? ''),
                            )}
                          >
                            {code === 'HALF_DAY'
                              ? 'H'
                              : code === 'LEAVE'
                                ? 'LV'
                                : code === 'EXCUSED'
                                  ? 'E'
                                  : code[0]}
                            <span className="sr-only">{code}</span>
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        disabled={locked}
                        value={r.remark ?? ''}
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((x) =>
                              x.studentId === r.studentId ? { ...x, remark: e.target.value } : x,
                            ),
                          )
                        }
                        className="h-9 w-full rounded-lg border border-slate-200 px-2 text-sm"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 md:hidden">
            {filtered.map((r) => (
              <article
                key={r.studentId}
                className="rounded-2xl border border-slate-200 bg-white p-3"
              >
                <p className="font-semibold">{r.fullName}</p>
                <p className="text-xs text-slate-500">
                  Roll {r.rollNumber ?? '—'} · {r.admissionNumber}
                </p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {['PRESENT', 'ABSENT', 'LATE'].map((code) => (
                    <button
                      key={code}
                      type="button"
                      disabled={locked}
                      onClick={() =>
                        setRows((prev) =>
                          prev.map((x) =>
                            x.studentId === r.studentId ? { ...x, status: code } : x,
                          ),
                        )
                      }
                      className={cn(
                        'sls-status-chip is-wide',
                        r.status === code && (STATUS_BTN[code] ?? ''),
                      )}
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
          <div className="sticky bottom-3 flex flex-wrap justify-end gap-2">
            <GhostButton
              type="button"
              disabled={save.isPending || locked}
              onClick={() => save.mutate(true)}
            >
              Save draft
            </GhostButton>
            <PrimaryButton
              type="button"
              disabled={save.isPending || roster.data?.holidayBlocked}
              onClick={() => save.mutate(false)}
            >
              Submit attendance
            </PrimaryButton>
          </div>
        </>
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
          Select a class to load the student list. All students default to Present — mark exceptions
          only.
        </p>
      )}
    </AttendanceShell>
  );
}
