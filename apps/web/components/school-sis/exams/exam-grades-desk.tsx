'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { canManageSchoolSis } from '@/lib/school-sis/permissions';
import { fetchSchoolGradeSystems, saveSchoolGradeSystem } from '@/services/school-sis';
import { apiErrorMessage } from '@/utils/api-error';
import { ExamCard, ExamShell, examField, num } from './exams-ui';
import { PrimaryButton } from '../academic/academic-ui';

const KINDS = ['PERCENTAGE', 'GRADE_POINT', 'CGPA', 'LETTER', 'DESCRIPTIVE', 'PASS_FAIL'];

export function ExamGradesDesk() {
  const enabled = useAuthQueryEnabled();
  const canManage = canManageSchoolSis(useAuthStore((s) => s.session?.user)?.permissions);
  const qc = useQueryClient();
  const systems = useQuery({
    queryKey: ['school-grade-systems'],
    queryFn: fetchSchoolGradeSystems,
    enabled,
  });
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    kind: 'PERCENTAGE',
    isDefault: false,
    bandsText:
      'A+,Outstanding,90,100,10\nA,Excellent,80,89.99,9\nB+,Very Good,70,79.99,8\nB,Good,60,69.99,7\nC,Satisfactory,50,59.99,6\nD,Needs improvement,35,49.99,5\nF,Fail,0,34.99,0',
  });

  const save = useMutation({
    mutationFn: () => {
      const bands = form.bandsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [code, label, min, max, point] = line.split(',').map((p) => p.trim());
          return {
            code,
            label: label || code,
            minPercent: Number(min),
            maxPercent: Number(max),
            gradePoint: Number(point || 0),
            description: label,
          };
        });
      return saveSchoolGradeSystem({
        name: form.name,
        kind: form.kind,
        isDefault: form.isDefault,
        bands,
      });
    },
    onSuccess: () => {
      setError(null);
      setForm({ ...form, name: '' });
      void qc.invalidateQueries({ queryKey: ['school-grade-systems'] });
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  return (
    <ExamShell
      title="Grades"
      subtitle="Create grading systems and boundaries. Values are school-configured, not board-hardcoded."
    >
      {error ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}
      {(systems.data ?? []).map((sys: any) => (
        <ExamCard key={sys.id}>
          <div className="mb-2 flex items-center justify-between">
            <p className="font-semibold text-[#1e3a8a]">
              {sys.name}{' '}
              <span className="text-xs font-normal text-slate-500">
                {sys.kind}
                {sys.isDefault ? ' · default' : ''}
              </span>
            </p>
          </div>
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="px-2 py-1">Grade</th>
                <th className="px-2 py-1">Min %</th>
                <th className="px-2 py-1">Max %</th>
                <th className="px-2 py-1">Point</th>
                <th className="px-2 py-1">Description</th>
              </tr>
            </thead>
            <tbody>
              {(sys.bands ?? []).map((b: any) => (
                <tr key={b.id} className="border-t border-slate-100">
                  <td className="px-2 py-1 font-medium">{b.code}</td>
                  <td className="px-2 py-1">{num(b.minPercent)}</td>
                  <td className="px-2 py-1">{num(b.maxPercent)}</td>
                  <td className="px-2 py-1">{num(b.gradePoint)}</td>
                  <td className="px-2 py-1 text-slate-500">{b.description || b.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ExamCard>
      ))}
      {canManage ? (
        <ExamCard>
          <p className="mb-3 font-semibold text-[#1e3a8a]">Add grading system</p>
          <div className="grid gap-3 md:grid-cols-3">
            <input
              className={examField}
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <select
              className={examField}
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value })}
            >
              {KINDS.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
              />
              Default system
            </label>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            One band per line: code,label,min,max,gradePoint
          </p>
          <textarea
            className="mt-1 min-h-[140px] w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
            value={form.bandsText}
            onChange={(e) => setForm({ ...form, bandsText: e.target.value })}
          />
          <PrimaryButton className="mt-3" disabled={!form.name} onClick={() => save.mutate()}>
            Save system
          </PrimaryButton>
        </ExamCard>
      ) : null}
    </ExamShell>
  );
}
