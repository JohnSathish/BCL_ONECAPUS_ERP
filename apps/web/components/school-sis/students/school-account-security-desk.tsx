'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchSchoolAcademicClasses } from '@/services/school-sis';
import {
  bulkSchoolActivationCodes,
  disableSchoolAccount,
  fetchSchoolAccountEvents,
  fetchSchoolAccountSettings,
  fetchSchoolAccountStudents,
  issueSchoolActivationCode,
  resetSchoolAccountPassword,
  revokeSchoolAccountSessions,
  saveSchoolAccountSettings,
  unlockSchoolAccount,
  type SchoolAccountStudent,
} from '@/services/school-account-security';
import { apiErrorMessage } from '@/utils/api-error';

const STATUSES = ['', 'NOT_ACTIVATED', 'ACTIVE', 'LOCKED', 'DISABLED'];

export function SchoolAccountSecurityDesk() {
  const ready = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [codeOnce, setCodeOnce] = useState<{ name: string; code: string; notice?: string } | null>(
    null,
  );
  const [sheets, setSheets] = useState<
    Array<{ fullName: string; admissionNumber: string; classLabel: string; code: string }>
  >([]);
  const [eventsFor, setEventsFor] = useState<string | null>(null);

  const students = useQuery({
    queryKey: ['school-account-students', q, status, sectionId],
    queryFn: () =>
      fetchSchoolAccountStudents({
        q: q || undefined,
        status: status || undefined,
        sectionId: sectionId || undefined,
      }),
    enabled: ready,
  });
  const settings = useQuery({
    queryKey: ['school-account-settings'],
    queryFn: fetchSchoolAccountSettings,
    enabled: ready,
  });
  const classes = useQuery({
    queryKey: ['school-academic-classes'],
    queryFn: fetchSchoolAcademicClasses,
    enabled: ready,
  });
  const events = useQuery({
    queryKey: ['school-account-events', eventsFor],
    queryFn: () => fetchSchoolAccountEvents(eventsFor ?? undefined),
    enabled: ready && Boolean(eventsFor),
  });

  const sections = classes.data?.sections ?? [];

  const saveSettings = useMutation({
    mutationFn: saveSchoolAccountSettings,
    onSuccess: () => {
      setNotice('Security settings saved.');
      void qc.invalidateQueries({ queryKey: ['school-account-settings'] });
    },
    onError: (e) => setNotice(apiErrorMessage(e)),
  });

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      setNotice(ok);
      void qc.invalidateQueries({ queryKey: ['school-account-students'] });
    } catch (e) {
      setNotice(apiErrorMessage(e));
    }
  };

  const rows = students.data ?? [];
  const setting = settings.data ?? {};

  const printSheets = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Student account security</h1>
        <p className="mt-1 text-sm text-slate-600">
          Activation codes are shown once. Students create their own password after OTP or office
          code verification. There is no shared school password.
        </p>
      </div>

      {notice ? (
        <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">{notice}</p>
      ) : null}
      {codeOnce ? (
        <div className="rounded border border-amber-300 bg-amber-50 px-3 py-3 text-sm">
          <p className="font-medium">{codeOnce.name}</p>
          <p className="mt-1 font-mono text-lg tracking-wide">{codeOnce.code}</p>
          <p className="mt-1 text-slate-600">{codeOnce.notice}</p>
          <button className="mt-2 text-xs underline" onClick={() => setCodeOnce(null)}>
            Hide code
          </button>
        </div>
      ) : null}

      <section className="rounded-lg border bg-white p-4" key={String(setting.id ?? 'settings')}>
        <h2 className="text-sm font-semibold">Login protection</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {(
            [
              ['maxLoginAttempts', 'Max login attempts'],
              ['lockMinutes', 'Lock minutes'],
              ['otpTtlSeconds', 'OTP expiry (seconds)'],
              ['otpResendSeconds', 'OTP resend interval'],
              ['maxOtpAttempts', 'Max OTP attempts'],
              ['activationCodeHours', 'Activation code hours'],
              ['passwordMinLength', 'Password min length'],
              ['historyCount', 'Password history'],
              ['maxSessions', 'Max sessions'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="text-xs text-slate-600">
              {label}
              <input
                className="mt-1 w-full rounded border px-2 py-1 text-sm"
                type="number"
                defaultValue={Number(setting[key] ?? 0)}
                onBlur={(e) => saveSettings.mutate({ [key]: Number(e.target.value) })}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <div className="flex flex-wrap gap-2">
          <input
            className="rounded border px-2 py-1 text-sm"
            placeholder="Search name or admission"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="rounded border px-2 py-1 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {STATUSES.map((s) => (
              <option key={s || 'all'} value={s}>
                {s || 'All statuses'}
              </option>
            ))}
          </select>
          <select
            className="rounded border px-2 py-1 text-sm"
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
          >
            <option value="">All classes</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.grade.name} {s.name}
              </option>
            ))}
          </select>
          <button
            className="rounded bg-slate-900 px-3 py-1 text-sm text-white"
            disabled={!sectionId}
            onClick={async () => {
              if (!sectionId) return;
              try {
                const res = await bulkSchoolActivationCodes(sectionId);
                setSheets(res.sheets);
                setNotice(`Generated ${res.count} unique activation codes for ${res.year}.`);
              } catch (e) {
                setNotice(apiErrorMessage(e));
              }
            }}
          >
            Generate activation codes
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-slate-500">
                <th className="py-2">Student</th>
                <th>Admission</th>
                <th>Class</th>
                <th>Status</th>
                <th>Last login</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row: SchoolAccountStudent) => (
                <tr key={row.studentId} className="border-b">
                  <td className="py-2 font-medium">{row.fullName}</td>
                  <td>{row.admissionNumber}</td>
                  <td>{row.classLabel ?? '—'}</td>
                  <td>{row.accountStatus}</td>
                  <td>{row.lastLoginAt ? new Date(row.lastLoginAt).toLocaleString() : '—'}</td>
                  <td className="space-x-2 whitespace-nowrap text-xs">
                    {row.userId ? (
                      <>
                        <button
                          className="underline"
                          onClick={async () => {
                            const issued = await issueSchoolActivationCode(row.userId!);
                            setCodeOnce({
                              name: row.fullName,
                              code: issued.code,
                              notice: issued.notice,
                            });
                          }}
                        >
                          Generate code
                        </button>
                        <button
                          className="underline"
                          onClick={async () => {
                            const issued = await resetSchoolAccountPassword(row.userId!);
                            setCodeOnce({
                              name: row.fullName,
                              code: issued.code,
                              notice: issued.notice,
                            });
                            void qc.invalidateQueries({ queryKey: ['school-account-students'] });
                          }}
                        >
                          Reset password
                        </button>
                        <button
                          className="underline"
                          onClick={() =>
                            void run(() => unlockSchoolAccount(row.userId!), 'Account unlocked')
                          }
                        >
                          Unlock
                        </button>
                        <button
                          className="underline"
                          onClick={() =>
                            void run(
                              () => revokeSchoolAccountSessions(row.userId!),
                              'Sessions revoked',
                            )
                          }
                        >
                          Revoke sessions
                        </button>
                        <button
                          className="underline text-rose-700"
                          onClick={() =>
                            void run(() => disableSchoolAccount(row.userId!), 'Account disabled')
                          }
                        >
                          Disable
                        </button>
                        <button className="underline" onClick={() => setEventsFor(row.userId)}>
                          Activity
                        </button>
                      </>
                    ) : (
                      <span className="text-slate-400">No login user yet</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {sheets.length ? (
        <section className="rounded-lg border bg-white p-4 print:border-0">
          <div className="mb-3 flex items-center justify-between print:hidden">
            <h2 className="text-sm font-semibold">Activation sheets ({sheets.length})</h2>
            <button className="rounded border px-3 py-1 text-sm" onClick={printSheets}>
              Print
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {sheets.map((sheet) => (
              <div key={sheet.admissionNumber + sheet.code} className="rounded border p-3">
                <p className="font-medium">{sheet.fullName}</p>
                <p className="text-sm">Admission No. {sheet.admissionNumber}</p>
                <p className="text-sm">{sheet.classLabel}</p>
                <p className="mt-2 font-mono text-lg tracking-wide">{sheet.code}</p>
                <p className="mt-1 text-xs text-slate-500">
                  One-time code. Activate in the school app, then create your own password.
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {eventsFor ? (
        <section className="rounded-lg border bg-white p-4">
          <div className="mb-2 flex justify-between">
            <h2 className="text-sm font-semibold">Login activity</h2>
            <button className="text-xs underline" onClick={() => setEventsFor(null)}>
              Close
            </button>
          </div>
          <ul className="space-y-1 text-sm">
            {(events.data ?? []).map((ev) => (
              <li key={ev.id}>
                {new Date(ev.createdAt).toLocaleString()} · {ev.event}
                {ev.reason ? ` · ${ev.reason}` : ''}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
