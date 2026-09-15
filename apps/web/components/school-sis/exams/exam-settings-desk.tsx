'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { canManageSchoolSis } from '@/lib/school-sis/permissions';
import {
  fetchSchoolExamSettings,
  fetchSchoolExamTypes,
  fetchSchoolGradeSystems,
  saveSchoolExamSettings,
  saveSchoolExamType,
} from '@/services/school-sis';
import { apiErrorMessage } from '@/utils/api-error';
import { ExamCard, ExamShell, examField, num } from './exams-ui';
import { PrimaryButton } from '../academic/academic-ui';
import { cn } from '@/utils/cn';

const TABS = [
  'General',
  'Exams',
  'Assessment',
  'Marks',
  'Grades',
  'Results',
  'Ranking',
  'Promotion',
  'Report Cards',
  'Notifications',
] as const;

export function ExamSettingsDesk() {
  const enabled = useAuthQueryEnabled();
  const canManage = canManageSchoolSis(useAuthStore((s) => s.session?.user)?.permissions);
  const qc = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]>('General');
  const [error, setError] = useState<string | null>(null);
  const settings = useQuery({
    queryKey: ['school-exam-settings'],
    queryFn: fetchSchoolExamSettings,
    enabled,
  });
  const types = useQuery({
    queryKey: ['school-exam-types'],
    queryFn: fetchSchoolExamTypes,
    enabled,
  });
  const grades = useQuery({
    queryKey: ['school-grade-systems'],
    queryFn: fetchSchoolGradeSystems,
    enabled,
  });
  const [form, setForm] = useState<Record<string, any>>({});
  const [typeForm, setTypeForm] = useState({
    name: '',
    code: '',
    description: '',
    defaultWeight: 100,
    active: true,
  });

  useEffect(() => {
    if (settings.data) setForm(settings.data);
  }, [settings.data]);

  const save = useMutation({
    mutationFn: () =>
      saveSchoolExamSettings({
        passPercent: Number(form.passPercent),
        rankingEnabled: Boolean(form.rankingEnabled),
        rankingMethod: form.rankingMethod,
        rankingTie: form.rankingTie,
        graceEnabled: Boolean(form.graceEnabled),
        graceMax: Number(form.graceMax),
        decimalPlaces: Number(form.decimalPlaces),
        rounding: form.rounding,
        absentCode: form.absentCode,
        medicalCode: form.medicalCode,
        notAppearedCode: form.notAppearedCode,
        attendanceMinPercent: Number(form.attendanceMinPercent),
        attendanceAffectsResult: Boolean(form.attendanceAffectsResult),
        requirePassEverySubject: Boolean(form.requirePassEverySubject),
        maxFailedSubjects: Number(form.maxFailedSubjects),
        requireTheoryPass: Boolean(form.requireTheoryPass),
        approvalWorkflow: Boolean(form.approvalWorkflow),
        allowNegativeMarks: Boolean(form.allowNegativeMarks),
        defaultGradeSystemId: form.defaultGradeSystemId || undefined,
        reportTemplate: form.reportTemplate,
        showRankOnCard: Boolean(form.showRankOnCard),
        showPhotoOnCard: Boolean(form.showPhotoOnCard),
        remarkBands: form.remarkBands,
      }),
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: ['school-exam-settings'] });
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const saveType = useMutation({
    mutationFn: () => saveSchoolExamType(typeForm),
    onSuccess: () => {
      setTypeForm({ name: '', code: '', description: '', defaultWeight: 100, active: true });
      void qc.invalidateQueries({ queryKey: ['school-exam-types'] });
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  function Field({
    label,
    hint,
    children,
  }: {
    label: string;
    hint?: string;
    children: React.ReactNode;
  }) {
    return (
      <label className="block text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        {hint ? (
          <p className="mb-1 text-xs text-slate-500">{hint}</p>
        ) : (
          <span className="mb-1 block" />
        )}
        {children}
      </label>
    );
  }

  return (
    <ExamShell
      title="Examination Configuration"
      subtitle="School-level defaults. Individual examinations can override these rules."
    >
      {error ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}
      <div className="flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-semibold ring-1',
              tab === t
                ? 'bg-[#2563eb] text-white ring-[#2563eb]'
                : 'bg-white text-slate-600 ring-slate-200',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'General' ? (
        <ExamCard className="grid gap-3 md:grid-cols-2">
          <Field
            label="Default pass percentage"
            hint="Used when a subject does not set its own pass mark."
          >
            <input
              className={examField}
              type="number"
              value={form.passPercent ?? ''}
              onChange={(e) => setForm({ ...form, passPercent: e.target.value })}
            />
          </Field>
          <Field
            label="Decimal places"
            hint="Precision for percentages on results and report cards."
          >
            <select
              className={examField}
              value={form.decimalPlaces ?? 2}
              onChange={(e) => setForm({ ...form, decimalPlaces: Number(e.target.value) })}
            >
              <option value={0}>0</option>
              <option value={1}>1</option>
              <option value={2}>2</option>
            </select>
          </Field>
          <Field label="Rounding" hint="How totals and percentages are rounded.">
            <select
              className={examField}
              value={form.rounding ?? 'MATH'}
              onChange={(e) => setForm({ ...form, rounding: e.target.value })}
            >
              <option value="MATH">Normal mathematical</option>
              <option value="NEAREST">Nearest integer</option>
              <option value="FLOOR">Floor</option>
              <option value="CEIL">Ceiling</option>
            </select>
          </Field>
          <Field label="Default grading system">
            <select
              className={examField}
              value={form.defaultGradeSystemId ?? ''}
              onChange={(e) => setForm({ ...form, defaultGradeSystemId: e.target.value })}
            >
              <option value="">—</option>
              {(grades.data ?? []).map((g: any) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </Field>
        </ExamCard>
      ) : null}

      {tab === 'Exams' ? (
        <ExamCard>
          <p className="mb-3 text-sm text-slate-600">
            Exam types are not hardcoded. Add Unit Test, Terminal, Annual, or any pattern your
            school uses.
          </p>
          <table className="mb-4 min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="py-1">Name</th>
                <th>Code</th>
                <th>Weight</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              {(types.data ?? []).map((t: any) => (
                <tr key={t.id} className="border-t">
                  <td className="py-1">{t.name}</td>
                  <td>{t.code}</td>
                  <td>{num(t.defaultWeight)}%</td>
                  <td>{t.active ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {canManage ? (
            <div className="grid gap-2 md:grid-cols-4">
              <input
                className={examField}
                placeholder="Type name"
                value={typeForm.name}
                onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
              />
              <input
                className={examField}
                placeholder="Code"
                value={typeForm.code}
                onChange={(e) => setTypeForm({ ...typeForm, code: e.target.value })}
              />
              <input
                className={examField}
                type="number"
                value={typeForm.defaultWeight}
                onChange={(e) =>
                  setTypeForm({ ...typeForm, defaultWeight: Number(e.target.value) })
                }
              />
              <PrimaryButton onClick={() => saveType.mutate()}>Add exam type</PrimaryButton>
            </div>
          ) : null}
        </ExamCard>
      ) : null}

      {tab === 'Assessment' ? (
        <ExamCard>
          <p className="text-sm text-slate-600">
            Assessment components (theory, practical, oral, notebook, project) are configured on
            each examination under Exams → open an examination. Weightage is stored per component
            and used by the result engine.
          </p>
        </ExamCard>
      ) : null}

      {tab === 'Marks' ? (
        <ExamCard className="grid gap-3 md:grid-cols-2">
          <Field
            label="Absent code"
            hint="Stored as a status. Never converted to zero automatically."
          >
            <input
              className={examField}
              value={form.absentCode ?? ''}
              onChange={(e) => setForm({ ...form, absentCode: e.target.value })}
            />
          </Field>
          <Field label="Medical exemption code">
            <input
              className={examField}
              value={form.medicalCode ?? ''}
              onChange={(e) => setForm({ ...form, medicalCode: e.target.value })}
            />
          </Field>
          <Field label="Not appeared code">
            <input
              className={examField}
              value={form.notAppearedCode ?? ''}
              onChange={(e) => setForm({ ...form, notAppearedCode: e.target.value })}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!form.allowNegativeMarks}
              onChange={(e) => setForm({ ...form, allowNegativeMarks: e.target.checked })}
            />
            Allow negative marks
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!form.approvalWorkflow}
              onChange={(e) => setForm({ ...form, approvalWorkflow: e.target.checked })}
            />
            Teacher submit → coordinator review before results
          </label>
        </ExamCard>
      ) : null}

      {tab === 'Grades' ? (
        <ExamCard>
          <p className="text-sm text-slate-600">
            Manage letter grades, points and descriptive bands on the Grades page. Changing bands
            does not rewrite published results (snapshots are stored on generate).
          </p>
        </ExamCard>
      ) : null}

      {tab === 'Results' ? (
        <ExamCard className="grid gap-3 md:grid-cols-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!form.requirePassEverySubject}
              onChange={(e) => setForm({ ...form, requirePassEverySubject: e.target.checked })}
            />
            Student must pass every subject
          </label>
          <Field
            label="Maximum failed subjects allowed"
            hint="Ignored when “pass every subject” is enabled."
          >
            <input
              className={examField}
              type="number"
              value={form.maxFailedSubjects ?? ''}
              onChange={(e) => setForm({ ...form, maxFailedSubjects: e.target.value })}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!form.requireTheoryPass}
              onChange={(e) => setForm({ ...form, requireTheoryPass: e.target.checked })}
            />
            Separate theory pass required
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!form.graceEnabled}
              onChange={(e) => setForm({ ...form, graceEnabled: e.target.checked })}
            />
            Allow grace marks
          </label>
          <Field label="Maximum grace marks">
            <input
              className={examField}
              type="number"
              value={form.graceMax ?? ''}
              onChange={(e) => setForm({ ...form, graceMax: e.target.value })}
            />
          </Field>
        </ExamCard>
      ) : null}

      {tab === 'Ranking' ? (
        <ExamCard className="grid gap-3 md:grid-cols-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!form.rankingEnabled}
              onChange={(e) => setForm({ ...form, rankingEnabled: e.target.checked })}
            />
            Enable ranking (if off, rank is hidden everywhere)
          </label>
          <Field label="Ranking method">
            <select
              className={examField}
              value={form.rankingMethod ?? 'SECTION'}
              onChange={(e) => setForm({ ...form, rankingMethod: e.target.value })}
            >
              <option value="NONE">No rank</option>
              <option value="SECTION">Section rank</option>
              <option value="CLASS">Class rank</option>
              <option value="COMBINED">Combined class rank</option>
              <option value="HOUSE">House rank</option>
            </select>
          </Field>
          <Field label="Tie handling">
            <select
              className={examField}
              value={form.rankingTie ?? 'COMPETITION'}
              onChange={(e) => setForm({ ...form, rankingTie: e.target.value })}
            >
              <option value="COMPETITION">Competition (1,2,2,4)</option>
              <option value="DENSE">Dense (1,2,2,3)</option>
              <option value="STANDARD">Standard</option>
            </select>
          </Field>
        </ExamCard>
      ) : null}

      {tab === 'Promotion' ? (
        <ExamCard className="grid gap-3 md:grid-cols-2">
          <Field
            label="Attendance minimum %"
            hint="Used if attendance is configured to affect promotion. Attendance registers are not duplicated here."
          >
            <input
              className={examField}
              type="number"
              value={form.attendanceMinPercent ?? ''}
              onChange={(e) => setForm({ ...form, attendanceMinPercent: e.target.value })}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!form.attendanceAffectsResult}
              onChange={(e) => setForm({ ...form, attendanceAffectsResult: e.target.checked })}
            />
            Attendance can affect result / promotion eligibility
          </label>
          <p className="md:col-span-2 text-sm text-slate-600">
            Promote eligible students from Academic → Promotion after the final examination is
            published. Manual override with reason is already supported there.
          </p>
        </ExamCard>
      ) : null}

      {tab === 'Report Cards' ? (
        <ExamCard className="grid gap-3 md:grid-cols-2">
          <Field label="Template">
            <select
              className={examField}
              value={form.reportTemplate ?? 'STANDARD'}
              onChange={(e) => setForm({ ...form, reportTemplate: e.target.value })}
            >
              <option value="STANDARD">Template A · Standard</option>
              <option value="COMPACT">Template B · Compact</option>
              <option value="DESCRIPTIVE">Template C · Descriptive</option>
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!form.showRankOnCard}
              onChange={(e) => setForm({ ...form, showRankOnCard: e.target.checked })}
            />
            Show rank on report card
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!form.showPhotoOnCard}
              onChange={(e) => setForm({ ...form, showPhotoOnCard: e.target.checked })}
            />
            Show student photo placeholder
          </label>
        </ExamCard>
      ) : null}

      {tab === 'Notifications' ? (
        <ExamCard>
          <p className="text-sm text-slate-600">
            Exam scheduled, timetable, marks reminder, result published and report-card events use
            the school notification channel already configured for this tenant. Providers are not
            hardcoded in this module.
          </p>
        </ExamCard>
      ) : null}

      {canManage ? (
        <PrimaryButton disabled={save.isPending} onClick={() => save.mutate()}>
          Save configuration
        </PrimaryButton>
      ) : null}
    </ExamShell>
  );
}
