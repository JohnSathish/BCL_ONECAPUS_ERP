'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { canManageAttendanceSettings } from '@/lib/school-sis/permissions';
import {
  deleteSchoolAttendanceClassRule,
  fetchSchoolAcademicClasses,
  fetchSchoolAcademicYears,
  fetchSchoolAttendanceSettings,
  saveSchoolAttendanceClassRule,
  saveSchoolAttendanceSettings,
  saveSchoolAttendanceStatus,
} from '@/services/school-sis';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import {
  AcademicCard,
  AcademicPageHeader,
  AcademicTable,
  Field,
  GhostButton,
  PrimaryButton,
  Td,
  Th,
  confirmAction,
  fieldClass,
} from '../academic/academic-ui';

type TabId =
  | 'general'
  | 'statuses'
  | 'calculation'
  | 'thresholds'
  | 'class-rules'
  | 'locking'
  | 'notifications'
  | 'permissions';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'general', label: 'General' },
  { id: 'statuses', label: 'Statuses' },
  { id: 'calculation', label: 'Calculation' },
  { id: 'thresholds', label: 'Thresholds' },
  { id: 'class-rules', label: 'Class Rules' },
  { id: 'locking', label: 'Locking & Corrections' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'permissions', label: 'Permissions' },
];

const POLICY_KEYS = [
  'enabled',
  'allowEditing',
  'allowCorrections',
  'correctionWindowDays',
  'correctionReasonRequired',
  'teacherCanEditSubmitted',
  'goodPercent',
  'presentWeight',
  'lateWeight',
  'absentWeight',
  'lockMode',
  'lockAfterDays',
  'adminCanUnlock',
  'notifyInApp',
  'notifyPush',
  'notifySms',
  'notifyWhatsapp',
  'notifyCorrection',
  'notifyRepeatedAbsence',
  'countHolidaysAsWorking',
  'countWeeklyOffAsWorking',
  'countExamAsWorking',
  'countEventsAsWorking',
] as const;

type StatusRow = {
  id: string;
  code: string;
  shortCode?: string;
  name: string;
  countsPresent: boolean;
  countsAbsent: boolean;
  countsTowardPct: boolean;
  attendanceValue: number;
  active: boolean;
  isSystem?: boolean;
};

const PERMISSION_HELP = [
  ['View Attendance', 'attendance.view'],
  ['Mark Attendance', 'attendance.create'],
  ['Edit Attendance', 'attendance.update'],
  ['Submit Attendance', 'attendance.submit'],
  ['Request Correction', 'attendance.correction.request'],
  ['Approve Correction', 'attendance.approve'],
  ['Unlock Attendance', 'attendance.lock'],
  ['View Attendance Reports', 'attendance.reports.view'],
  ['Export Attendance Reports', 'attendance.reports.export'],
  ['Manage Attendance Settings', 'attendance.settings.manage'],
];

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 rounded-full transition',
          checked ? 'bg-emerald-500' : 'bg-slate-300',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition',
            checked ? 'left-5' : 'left-0.5',
          )}
        />
      </button>
    </label>
  );
}

export function AttendanceSettingsDesk({ variant = 'academic' }: { variant?: 'academic' | 'ops' }) {
  const enabled = useAuthQueryEnabled();
  const perms = useAuthStore((s) => s.session?.user)?.permissions;
  const canManage = canManageAttendanceSettings(perms);
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabId>('general');
  const [yearId, setYearId] = useState('');
  const [form, setForm] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusDraft, setStatusDraft] = useState<StatusRow | null>(null);
  const years = useQuery({
    queryKey: ['school-academic-years'],
    queryFn: fetchSchoolAcademicYears,
    enabled,
  });
  const classes = useQuery({
    queryKey: ['school-academic-classes'],
    queryFn: fetchSchoolAcademicClasses,
    enabled,
  });
  useEffect(() => {
    if (yearId) return;
    const current = (years.data ?? []).find((y) => y.status === 'CURRENT');
    if (current) setYearId(current.id);
    else if (years.data?.[0]) setYearId(years.data[0].id);
  }, [years.data, yearId]);
  const q = useQuery({
    queryKey: ['school-att-settings', yearId],
    queryFn: () => fetchSchoolAttendanceSettings(yearId || undefined),
    enabled: enabled && Boolean(yearId),
  });
  const server = (q.data?.settings ?? {}) as Record<string, unknown>;
  const f = form ?? server;
  const dirty = Boolean(form);
  useEffect(() => {
    function onLeave(e: BeforeUnloadEvent) {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [dirty]);
  const save = useMutation({
    mutationFn: () => {
      const policy: Record<string, unknown> = {};
      for (const key of POLICY_KEYS) policy[key] = f[key];
      return saveSchoolAttendanceSettings(
        {
          academicYearId: yearId,
          mode: f.mode,
          defaultStatus: f.defaultStatus,
          defaultMarking: f.defaultMarking,
          lockEnabled: f.lockEnabled,
          lockAfterHours: f.lockAfterHours,
          correctionRequired: f.correctionRequired,
          minPercent: f.minPercent,
          warnPercent: f.warnPercent,
          lateCountsPresent: Number(f.lateWeight ?? 1) > 0,
          halfDayValue: f.halfDayValue,
          leaveCountsPresent: f.leaveCountsPresent,
          excusedCountsPresent: f.excusedCountsPresent,
          absentNotify: f.absentNotify,
          lateNotify: f.lateNotify,
          lowAttendanceNotify: f.lowAttendanceNotify,
          consecutiveAbsentAlert: f.consecutiveAbsentAlert,
          qrEnabled: f.qrEnabled,
          geoEnabled: f.geoEnabled,
          policy,
        },
        yearId,
      );
    },
    onSuccess: () => {
      setForm(null);
      setError(null);
      void qc.invalidateQueries({ queryKey: ['school-att-settings'] });
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });
  const saveStatus = useMutation({
    mutationFn: (row: StatusRow) =>
      saveSchoolAttendanceStatus(
        {
          code: row.code,
          shortCode: row.shortCode,
          name: row.name,
          countsPresent: row.countsPresent,
          countsAbsent: row.countsAbsent,
          countsTowardPct: row.countsTowardPct,
          attendanceValue: row.attendanceValue,
          active: row.active,
        },
        row.id.startsWith('new-') ? undefined : row.id,
      ),
    onSuccess: () => {
      setStatusDraft(null);
      void qc.invalidateQueries({ queryKey: ['school-att-settings'] });
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });
  const saveRule = useMutation({
    mutationFn: (payload: Record<string, unknown>) => saveSchoolAttendanceClassRule(payload),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['school-att-settings'] }),
    onError: (e) => setError(apiErrorMessage(e)),
  });
  const deleteRule = useMutation({
    mutationFn: deleteSchoolAttendanceClassRule,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['school-att-settings'] }),
    onError: (e) => setError(apiErrorMessage(e)),
  });
  function set<K extends string>(key: K, value: unknown) {
    setForm({ ...f, [key]: value });
  }
  function saveClicked() {
    if (server.enabled && f.enabled === false) {
      if (!confirmAction('Disable student attendance across web and mobile?')) return;
    }
    if (String(server.mode) !== String(f.mode)) {
      if (
        !confirmAction('Changing attendance mode does not rewrite historical registers. Continue?')
      )
        return;
    }
    save.mutate();
  }
  const statuses: StatusRow[] = q.data?.statuses ?? [];
  const rules = q.data?.classRules ?? [];
  const grades = classes.data?.grades ?? [];
  const sections = classes.data?.sections ?? [];
  const bands = useMemo(() => {
    const good = Number(f.goodPercent ?? 90);
    const warn = Number(f.warnPercent ?? 80);
    const min = Number(f.minPercent ?? 75);
    return [
      { label: 'Good', range: `${good}%+` },
      { label: 'Normal', range: `${warn}–${good - 1}%` },
      { label: 'Warning', range: `${min}–${warn - 1}%` },
      { label: 'Critical', range: `Below ${min}%` },
    ];
  }, [f.goodPercent, f.warnPercent, f.minPercent]);
  const [ruleForm, setRuleForm] = useState({
    gradeId: '',
    sectionId: '',
    mode: 'DAILY',
  });

  if (!canManage) {
    return (
      <div className="space-y-4">
        {variant === 'academic' ? (
          <AcademicPageHeader
            title="Attendance Settings"
            description="Only authorised administrators can change how student attendance works."
          />
        ) : null}
        <AcademicCard>
          <p className="text-sm text-slate-600">
            You do not have permission to manage attendance settings.
          </p>
        </AcademicCard>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AcademicPageHeader
        title="Attendance Settings"
        description="Central rules for student attendance on the ERP, staff portal and mobile app. Historical registers are not rewritten when you save."
        actions={
          <>
            <select
              className={cn(fieldClass, 'w-48')}
              value={yearId}
              onChange={(e) => {
                if (dirty && !confirmAction('Discard unsaved changes?')) return;
                setForm(null);
                setYearId(e.target.value);
              }}
            >
              {(years.data ?? []).map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </select>
            <GhostButton
              type="button"
              onClick={() => {
                if (dirty && !confirmAction('Reset unsaved changes?')) return;
                setForm(null);
              }}
            >
              Reset
            </GhostButton>
            <PrimaryButton type="button" onClick={saveClicked} disabled={save.isPending || !dirty}>
              {save.isPending ? 'Saving…' : 'Save changes'}
            </PrimaryButton>
          </>
        }
      />
      {dirty ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          You have unsaved changes.
        </p>
      ) : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <nav className="flex flex-wrap gap-1 rounded-2xl border border-slate-200 bg-white p-1.5">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              'rounded-xl px-3 py-2 text-xs font-medium sm:text-sm',
              tab === item.id ? 'bg-[#1e3a8a] text-white' : 'text-slate-600 hover:bg-slate-50',
            )}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === 'general' ? (
        <AcademicCard className="grid gap-3 md:grid-cols-2">
          <Toggle
            label="Student attendance"
            checked={Boolean(f.enabled ?? true)}
            onChange={(v) => set('enabled', v)}
          />
          <Field label="Attendance mode">
            <select
              className={fieldClass}
              value={String(f.mode ?? 'DAILY')}
              onChange={(e) => set('mode', e.target.value)}
            >
              <option value="DAILY">Daily</option>
              <option value="PERIOD">Period-wise</option>
              <option value="BOTH">Daily and period</option>
            </select>
          </Field>
          <Field label="Default status">
            <select
              className={fieldClass}
              value={String(f.defaultStatus ?? 'PRESENT')}
              onChange={(e) => set('defaultStatus', e.target.value)}
            >
              {statuses
                .filter((s) => s.active)
                .map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.shortCode || s.code} — {s.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Default marking">
            <select
              className={fieldClass}
              value={String(f.defaultMarking ?? 'ALL_PRESENT')}
              onChange={(e) => set('defaultMarking', e.target.value)}
            >
              <option value="ALL_PRESENT">All present</option>
              <option value="BLANK">Blank</option>
            </select>
          </Field>
          <Toggle
            label="Allow attendance editing"
            checked={Boolean(f.allowEditing ?? true)}
            onChange={(v) => set('allowEditing', v)}
          />
          <Toggle
            label="Allow corrections"
            checked={Boolean(f.allowCorrections ?? true)}
            onChange={(v) => set('allowCorrections', v)}
          />
        </AcademicCard>
      ) : null}

      {tab === 'statuses' ? (
        <AcademicCard>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Attendance statuses</h2>
            <GhostButton
              type="button"
              onClick={() =>
                setStatusDraft({
                  id: `new-${Date.now()}`,
                  code: '',
                  shortCode: '',
                  name: '',
                  countsPresent: false,
                  countsAbsent: true,
                  countsTowardPct: true,
                  attendanceValue: 0,
                  active: true,
                })
              }
            >
              Add status
            </GhostButton>
          </div>
          <AcademicTable>
            <thead>
              <tr>
                <Th>Code</Th>
                <Th>Short</Th>
                <Th>Name</Th>
                <Th>Present</Th>
                <Th>Absent</Th>
                <Th>Counts in %</Th>
                <Th>Value</Th>
                <Th>Active</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {statuses.map((st) => (
                <tr key={st.id} className="border-t">
                  <Td className="font-mono">{st.code}</Td>
                  <Td>{st.shortCode || '—'}</Td>
                  <Td>{st.name}</Td>
                  <Td>{st.countsPresent ? 'Yes' : 'No'}</Td>
                  <Td>{st.countsAbsent ? 'Yes' : 'No'}</Td>
                  <Td>{st.countsTowardPct ? 'Yes' : 'No'}</Td>
                  <Td>{Number(st.attendanceValue)}</Td>
                  <Td>{st.active ? 'On' : 'Off'}</Td>
                  <Td>
                    <button
                      type="button"
                      className="text-sm text-[#1e3a8a]"
                      onClick={() =>
                        setStatusDraft({ ...st, attendanceValue: Number(st.attendanceValue) })
                      }
                    >
                      Edit
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </AcademicTable>
          {statusDraft ? (
            <div className="mt-4 grid gap-3 rounded-xl border bg-slate-50 p-3 md:grid-cols-3">
              <Field label="Code">
                <input
                  className={fieldClass}
                  value={statusDraft.code}
                  disabled={Boolean(statusDraft.isSystem)}
                  onChange={(e) =>
                    setStatusDraft({ ...statusDraft, code: e.target.value.toUpperCase() })
                  }
                />
              </Field>
              <Field label="Short code">
                <input
                  className={fieldClass}
                  value={statusDraft.shortCode ?? ''}
                  onChange={(e) =>
                    setStatusDraft({ ...statusDraft, shortCode: e.target.value.toUpperCase() })
                  }
                />
              </Field>
              <Field label="Display name">
                <input
                  className={fieldClass}
                  value={statusDraft.name}
                  onChange={(e) => setStatusDraft({ ...statusDraft, name: e.target.value })}
                />
              </Field>
              <Field label="Value in %">
                <input
                  type="number"
                  step="0.1"
                  className={fieldClass}
                  value={statusDraft.attendanceValue}
                  onChange={(e) =>
                    setStatusDraft({ ...statusDraft, attendanceValue: Number(e.target.value) })
                  }
                />
              </Field>
              <Toggle
                label="Counts as present"
                checked={statusDraft.countsPresent}
                onChange={(v) => setStatusDraft({ ...statusDraft, countsPresent: v })}
              />
              <Toggle
                label="Counts as absent"
                checked={statusDraft.countsAbsent}
                onChange={(v) => setStatusDraft({ ...statusDraft, countsAbsent: v })}
              />
              <Toggle
                label="Counts toward percentage"
                checked={statusDraft.countsTowardPct}
                onChange={(v) => setStatusDraft({ ...statusDraft, countsTowardPct: v })}
              />
              <Toggle
                label="Enabled"
                checked={statusDraft.active}
                onChange={(v) => setStatusDraft({ ...statusDraft, active: v })}
              />
              <div className="flex items-end gap-2">
                <PrimaryButton
                  type="button"
                  disabled={saveStatus.isPending}
                  onClick={() => saveStatus.mutate(statusDraft)}
                >
                  Save status
                </PrimaryButton>
                <GhostButton type="button" onClick={() => setStatusDraft(null)}>
                  Cancel
                </GhostButton>
              </div>
            </div>
          ) : null}
        </AcademicCard>
      ) : null}

      {tab === 'calculation' ? (
        <AcademicCard className="grid gap-3 md:grid-cols-2">
          <Field label="Present weight">
            <input
              type="number"
              step="0.1"
              className={fieldClass}
              value={Number(f.presentWeight ?? 1)}
              onChange={(e) => set('presentWeight', Number(e.target.value))}
            />
          </Field>
          <Field label="Late weight">
            <input
              type="number"
              step="0.1"
              className={fieldClass}
              value={Number(f.lateWeight ?? 1)}
              onChange={(e) => set('lateWeight', Number(e.target.value))}
            />
          </Field>
          <Field label="Half-day weight">
            <input
              type="number"
              step="0.1"
              className={fieldClass}
              value={Number(f.halfDayValue ?? 0.5)}
              onChange={(e) => set('halfDayValue', Number(e.target.value))}
            />
          </Field>
          <Field label="Absent weight">
            <input
              type="number"
              step="0.1"
              className={fieldClass}
              value={Number(f.absentWeight ?? 0)}
              onChange={(e) => set('absentWeight', Number(e.target.value))}
            />
          </Field>
          <Toggle
            label="Leave counted toward %"
            checked={Boolean(f.leaveCountsPresent)}
            onChange={(v) => set('leaveCountsPresent', v)}
          />
          <Toggle
            label="Excused counted toward %"
            checked={Boolean(f.excusedCountsPresent ?? true)}
            onChange={(v) => set('excusedCountsPresent', v)}
          />
          <Toggle
            label="Count holidays as working days"
            checked={Boolean(f.countHolidaysAsWorking)}
            onChange={(v) => set('countHolidaysAsWorking', v)}
          />
          <Toggle
            label="Count weekly off / Sundays as working"
            checked={Boolean(f.countWeeklyOffAsWorking)}
            onChange={(v) => set('countWeeklyOffAsWorking', v)}
          />
          <Toggle
            label="Count examination days as working"
            checked={Boolean(f.countExamAsWorking ?? true)}
            onChange={(v) => set('countExamAsWorking', v)}
          />
          <Toggle
            label="Count school events as working"
            checked={Boolean(f.countEventsAsWorking ?? true)}
            onChange={(v) => set('countEventsAsWorking', v)}
          />
        </AcademicCard>
      ) : null}

      {tab === 'thresholds' ? (
        <AcademicCard className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Minimum required attendance %">
              <input
                type="number"
                className={fieldClass}
                value={Number(f.minPercent ?? 75)}
                onChange={(e) => set('minPercent', Number(e.target.value))}
              />
            </Field>
            <Field label="Warning threshold %">
              <input
                type="number"
                className={fieldClass}
                value={Number(f.warnPercent ?? 80)}
                onChange={(e) => set('warnPercent', Number(e.target.value))}
              />
            </Field>
            <Field label="Good threshold %">
              <input
                type="number"
                className={fieldClass}
                value={Number(f.goodPercent ?? 90)}
                onChange={(e) => set('goodPercent', Number(e.target.value))}
              />
            </Field>
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            {bands.map((b) => (
              <div key={b.label} className="rounded-xl border bg-slate-50 px-3 py-2 text-sm">
                <p className="font-semibold text-slate-800">{b.label}</p>
                <p className="text-slate-500">{b.range}</p>
              </div>
            ))}
          </div>
        </AcademicCard>
      ) : null}

      {tab === 'class-rules' ? (
        <AcademicCard className="space-y-4">
          <p className="text-sm text-slate-500">
            Override the school-wide mode for a class or section in the selected academic year.
          </p>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Class">
              <select
                className={fieldClass}
                value={ruleForm.gradeId}
                onChange={(e) =>
                  setRuleForm({ ...ruleForm, gradeId: e.target.value, sectionId: '' })
                }
              >
                <option value="">Select class</option>
                {grades.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Section (optional)">
              <select
                className={fieldClass}
                value={ruleForm.sectionId}
                onChange={(e) => setRuleForm({ ...ruleForm, sectionId: e.target.value })}
              >
                <option value="">All sections</option>
                {sections
                  .filter((s) => s.gradeId === ruleForm.gradeId)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Mode">
              <select
                className={fieldClass}
                value={ruleForm.mode}
                onChange={(e) => setRuleForm({ ...ruleForm, mode: e.target.value })}
              >
                <option value="DAILY">Daily</option>
                <option value="PERIOD">Period-wise</option>
                <option value="BOTH">Daily and period</option>
              </select>
            </Field>
            <div className="flex items-end">
              <PrimaryButton
                type="button"
                disabled={!ruleForm.gradeId || saveRule.isPending}
                onClick={() =>
                  saveRule.mutate({
                    academicYearId: yearId,
                    gradeId: ruleForm.gradeId,
                    sectionId: ruleForm.sectionId || undefined,
                    mode: ruleForm.mode,
                    active: true,
                  })
                }
              >
                Add rule
              </PrimaryButton>
            </div>
          </div>
          <AcademicTable>
            <thead>
              <tr>
                <Th>Year</Th>
                <Th>Class</Th>
                <Th>Section</Th>
                <Th>Mode</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rules.map(
                (r: {
                  id: string;
                  mode: string;
                  academicYear?: { name: string };
                  grade?: { name: string };
                  section?: { name: string } | null;
                }) => (
                  <tr key={r.id} className="border-t">
                    <Td>{r.academicYear?.name ?? '—'}</Td>
                    <Td>{r.grade?.name ?? '—'}</Td>
                    <Td>{r.section?.name ?? 'All'}</Td>
                    <Td>{r.mode}</Td>
                    <Td>
                      <button
                        type="button"
                        className="text-sm text-rose-600"
                        onClick={() => {
                          if (!confirmAction('Remove this class attendance rule?')) return;
                          deleteRule.mutate(r.id);
                        }}
                      >
                        Remove
                      </button>
                    </Td>
                  </tr>
                ),
              )}
            </tbody>
          </AcademicTable>
        </AcademicCard>
      ) : null}

      {tab === 'locking' ? (
        <AcademicCard className="grid gap-3 md:grid-cols-2">
          <Toggle
            label="Auto lock attendance"
            checked={Boolean(f.lockEnabled ?? true)}
            onChange={(v) => set('lockEnabled', v)}
          />
          <Field label="Lock after">
            <select
              className={fieldClass}
              value={String(f.lockMode ?? 'AFTER_DAYS')}
              onChange={(e) => set('lockMode', e.target.value)}
            >
              <option value="AFTER_SUBMIT">Immediately after submission</option>
              <option value="AFTER_HOURS">After a number of hours</option>
              <option value="AFTER_DAYS">After a number of days</option>
              <option value="END_OF_DAY">At the end of the academic day</option>
            </select>
          </Field>
          {String(f.lockMode) === 'AFTER_HOURS' ? (
            <Field label="Hours until lock">
              <input
                type="number"
                className={fieldClass}
                value={Number(f.lockAfterHours ?? 24)}
                onChange={(e) => set('lockAfterHours', Number(e.target.value))}
              />
            </Field>
          ) : null}
          {String(f.lockMode ?? 'AFTER_DAYS') === 'AFTER_DAYS' ? (
            <Field label="Days until lock">
              <input
                type="number"
                className={fieldClass}
                value={Number(f.lockAfterDays ?? 1)}
                onChange={(e) => set('lockAfterDays', Number(e.target.value))}
              />
            </Field>
          ) : null}
          <Toggle
            label="Administrator can unlock"
            checked={Boolean(f.adminCanUnlock ?? true)}
            onChange={(v) => set('adminCanUnlock', v)}
          />
          <Toggle
            label="Teachers can edit submitted attendance"
            checked={Boolean(f.teacherCanEditSubmitted)}
            onChange={(v) => set('teacherCanEditSubmitted', v)}
          />
          <Toggle
            label="Admin approval required for corrections"
            checked={Boolean(f.correctionRequired ?? true)}
            onChange={(v) => set('correctionRequired', v)}
          />
          <Field label="Correction window (days)">
            <input
              type="number"
              className={fieldClass}
              value={Number(f.correctionWindowDays ?? 7)}
              onChange={(e) => set('correctionWindowDays', Number(e.target.value))}
            />
          </Field>
          <Toggle
            label="Require reason for correction"
            checked={Boolean(f.correctionReasonRequired ?? true)}
            onChange={(v) => set('correctionReasonRequired', v)}
          />
        </AcademicCard>
      ) : null}

      {tab === 'notifications' ? (
        <AcademicCard className="grid gap-3 md:grid-cols-2">
          <Toggle
            label="Notify when student is absent"
            checked={Boolean(f.absentNotify ?? true)}
            onChange={(v) => set('absentNotify', v)}
          />
          <Toggle
            label="Notify when student is late"
            checked={Boolean(f.lateNotify)}
            onChange={(v) => set('lateNotify', v)}
          />
          <Toggle
            label="Notify when attendance is below threshold"
            checked={Boolean(f.lowAttendanceNotify ?? true)}
            onChange={(v) => set('lowAttendanceNotify', v)}
          />
          <Toggle
            label="Notify on attendance correction"
            checked={Boolean(f.notifyCorrection ?? true)}
            onChange={(v) => set('notifyCorrection', v)}
          />
          <Toggle
            label="Notify on repeated absence"
            checked={Boolean(f.notifyRepeatedAbsence ?? true)}
            onChange={(v) => set('notifyRepeatedAbsence', v)}
          />
          <Field label="Consecutive absence alert after (days)">
            <input
              type="number"
              className={fieldClass}
              value={Number(f.consecutiveAbsentAlert ?? 3)}
              onChange={(e) => set('consecutiveAbsentAlert', Number(e.target.value))}
            />
          </Field>
          <div className="md:col-span-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Toggle
              label="In-app"
              checked={Boolean(f.notifyInApp ?? true)}
              onChange={(v) => set('notifyInApp', v)}
            />
            <Toggle
              label="Push"
              checked={Boolean(f.notifyPush ?? true)}
              onChange={(v) => set('notifyPush', v)}
            />
            <Toggle
              label="SMS"
              checked={Boolean(f.notifySms)}
              onChange={(v) => set('notifySms', v)}
            />
            <Toggle
              label="WhatsApp"
              checked={Boolean(f.notifyWhatsapp)}
              onChange={(v) => set('notifyWhatsapp', v)}
            />
          </div>
          <p className="md:col-span-2 text-sm text-slate-500">
            A channel is skipped automatically when it is turned off here or not configured for the
            school.
          </p>
        </AcademicCard>
      ) : null}

      {tab === 'permissions' ? (
        <AcademicCard>
          <p className="mb-3 text-sm text-slate-500">
            Attendance access is assigned in Roles & Permissions. Settings here do not grant access
            by themselves.
          </p>
          <AcademicTable>
            <thead>
              <tr>
                <Th>Permission</Th>
                <Th>Slug</Th>
              </tr>
            </thead>
            <tbody>
              {PERMISSION_HELP.map(([label, slug]) => (
                <tr key={slug} className="border-t">
                  <Td>{label}</Td>
                  <Td className="font-mono text-xs">{slug}</Td>
                </tr>
              ))}
            </tbody>
          </AcademicTable>
          <p className="mt-3 text-sm">
            <Link href="/admin/school-sis/users/permissions" className="text-[#1e3a8a]">
              Open role permissions
            </Link>
          </p>
        </AcademicCard>
      ) : null}
    </div>
  );
}
