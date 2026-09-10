'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  assignSchoolSisClassTeacher,
  assignSchoolSisSubjectTeacher,
  fetchSchoolSisAllocations,
  fetchSchoolSisMasters,
  fetchSchoolSisStaff,
} from '@/services/school-sis';
import { apiErrorMessage } from '@/utils/api-error';

export default function SchoolSisAllocationPage() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [classForm, setClassForm] = useState({ sectionId: '', staffId: '' });
  const [subjectForm, setSubjectForm] = useState({
    sectionId: '',
    subjectId: '',
    staffId: '',
  });
  const masters = useQuery({
    queryKey: ['school-sis-masters'],
    queryFn: fetchSchoolSisMasters,
    enabled,
  });
  const staff = useQuery({ queryKey: ['school-sis-staff'], queryFn: fetchSchoolSisStaff, enabled });
  const alloc = useQuery({
    queryKey: ['school-sis-allocations'],
    queryFn: fetchSchoolSisAllocations,
    enabled,
  });
  const assignClass = useMutation({
    mutationFn: () => assignSchoolSisClassTeacher(classForm),
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: ['school-sis-allocations'] });
      void qc.invalidateQueries({ queryKey: ['school-sis-masters'] });
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });
  const assignSubject = useMutation({
    mutationFn: () => assignSchoolSisSubjectTeacher(subjectForm),
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: ['school-sis-allocations'] });
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });
  const teachers = (staff.data ?? []).filter((s) => s.staffType === 'TEACHING');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Class & staff allocation</h1>
        <p className="text-sm text-slate-500">
          Year-bound class teachers and subject teachers. Class timetable uses the same staff and
          subject masters.
        </p>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <form
        className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          assignClass.mutate();
        }}
      >
        <p className="sm:col-span-3 text-sm font-semibold">Class teacher</p>
        <div>
          <Label>Section</Label>
          <select
            className="mt-1 h-10 w-full rounded-md border px-3"
            value={classForm.sectionId}
            onChange={(e) => setClassForm((f) => ({ ...f, sectionId: e.target.value }))}
          >
            <option value="">Select</option>
            {(masters.data?.sections ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.grade.name} {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Teacher</Label>
          <select
            className="mt-1 h-10 w-full rounded-md border px-3"
            value={classForm.staffId}
            onChange={(e) => setClassForm((f) => ({ ...f, staffId: e.target.value }))}
          >
            <option value="">Select</option>
            {teachers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" className="self-end" disabled={assignClass.isPending}>
          Save class teacher
        </Button>
      </form>

      <form
        className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          assignSubject.mutate();
        }}
      >
        <p className="sm:col-span-4 text-sm font-semibold">Subject teacher</p>
        <div>
          <Label>Section</Label>
          <select
            className="mt-1 h-10 w-full rounded-md border px-3"
            value={subjectForm.sectionId}
            onChange={(e) => setSubjectForm((f) => ({ ...f, sectionId: e.target.value }))}
          >
            <option value="">Select</option>
            {(masters.data?.sections ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.grade.name} {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Subject</Label>
          <select
            className="mt-1 h-10 w-full rounded-md border px-3"
            value={subjectForm.subjectId}
            onChange={(e) => setSubjectForm((f) => ({ ...f, subjectId: e.target.value }))}
          >
            <option value="">Select</option>
            {(masters.data?.subjects ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Teacher</Label>
          <select
            className="mt-1 h-10 w-full rounded-md border px-3"
            value={subjectForm.staffId}
            onChange={(e) => setSubjectForm((f) => ({ ...f, staffId: e.target.value }))}
          >
            <option value="">Select</option>
            {teachers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" className="self-end" disabled={assignSubject.isPending}>
          Save subject teacher
        </Button>
      </form>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold">Class teachers</h2>
          <ul className="space-y-1 text-sm">
            {(alloc.data?.classTeachers ?? []).map((row) => (
              <li key={row.id}>
                {row.section.grade.name} {row.section.name} — {row.staff.fullName}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold">Subject teachers</h2>
          <ul className="space-y-1 text-sm">
            {(alloc.data?.subjectTeachers ?? []).map((row) => (
              <li key={row.id}>
                {row.section.grade.name} {row.section.name} · {row.subject.name} —{' '}
                {row.staff.fullName}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
