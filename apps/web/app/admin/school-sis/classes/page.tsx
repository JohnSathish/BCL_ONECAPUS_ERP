'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { createSchoolSisSection, fetchSchoolSisMasters } from '@/services/school-sis';
import { apiErrorMessage } from '@/utils/api-error';

export default function SchoolSisClassesPage() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [gradeId, setGradeId] = useState('');
  const [name, setName] = useState('B');
  const [error, setError] = useState<string | null>(null);
  const masters = useQuery({
    queryKey: ['school-sis-masters'],
    queryFn: fetchSchoolSisMasters,
    enabled,
  });
  const create = useMutation({
    mutationFn: createSchoolSisSection,
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: ['school-sis-masters'] });
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Classes & sections</h1>
        <p className="text-sm text-slate-500">
          Session {masters.data?.academicYear.name ?? '—'}. Class catalogue is school-only (not FYUP
          programmes).
        </p>
      </div>

      <form
        className="flex flex-wrap items-end gap-3 rounded-2xl border bg-white p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!gradeId) return;
          create.mutate({ gradeId, name });
        }}
      >
        <div>
          <Label htmlFor="grade">Class</Label>
          <select
            id="grade"
            className="mt-1 h-10 rounded-md border px-3"
            value={gradeId}
            onChange={(e) => setGradeId(e.target.value)}
          >
            <option value="">Select</option>
            {(masters.data?.grades ?? []).map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="sec">Section</Label>
          <Input
            id="sec"
            className="mt-1 h-10 w-24"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={create.isPending}>
          Add section
        </Button>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </form>

      <div className="overflow-x-auto rounded-2xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2">Class</th>
              <th className="px-4 py-2">Section</th>
              <th className="px-4 py-2">Enrolled</th>
              <th className="px-4 py-2">Class teacher</th>
            </tr>
          </thead>
          <tbody>
            {(masters.data?.sections ?? []).map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-4 py-2">{s.grade.name}</td>
                <td className="px-4 py-2">{s.name}</td>
                <td className="px-4 py-2">{s._count?.enrollments ?? 0}</td>
                <td className="px-4 py-2">{s.classTeachers?.[0]?.staff.fullName ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold">Subjects</h2>
        <p className="text-sm text-slate-600">
          {(masters.data?.subjects ?? []).map((s) => s.name).join(' · ') || '—'}
        </p>
      </div>
    </div>
  );
}
