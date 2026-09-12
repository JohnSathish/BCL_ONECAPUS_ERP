'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { canManageSchoolSis } from '@/lib/school-sis/permissions';
import {
  assignSchoolSisClassTeacher,
  assignSchoolSisSubjectTeacher,
  bulkMapSchoolClassSubjects,
  fetchSchoolClassSubjectMatrix,
  fetchSchoolSisMasters,
  fetchSchoolStaffMap,
} from '@/services/school-sis';
import { apiErrorMessage } from '@/utils/api-error';
import {
  AcademicCard,
  AcademicPageHeader,
  AcademicTable,
  EmptyState,
  PrimaryButton,
  SkeletonRows,
  Td,
  Th,
  fieldClass,
} from './academic-ui';

export function AcademicClassSubjectsPanel() {
  const enabled = useAuthQueryEnabled();
  const canManage = canManageSchoolSis(useAuthStore((s) => s.session?.user)?.permissions);
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['school-class-subjects'],
    queryFn: fetchSchoolClassSubjectMatrix,
    enabled,
  });
  const [error, setError] = useState<string | null>(null);
  const [gradeIds, setGradeIds] = useState<string[]>([]);
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [filter, setFilter] = useState('');
  const save = useMutation({
    mutationFn: () => bulkMapSchoolClassSubjects({ gradeIds, subjectIds }),
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: ['school-class-subjects'] });
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });
  const rows = useMemo(() => {
    const list = query.data?.rows ?? [];
    const term = filter.trim().toLowerCase();
    if (!term) return list;
    return list.filter((r) =>
      `${r.className} ${r.sectionName} ${r.subjectName ?? ''} ${r.teacher?.fullName ?? ''}`
        .toLowerCase()
        .includes(term),
    );
  }, [query.data, filter]);

  return (
    <div className="space-y-5">
      <AcademicPageHeader
        title="Class-wise subjects"
        description="Map subjects to one or more classes at once. Subject teachers appear per section."
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {canManage ? (
        <AcademicCard className="grid gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-semibold">Classes</p>
            <div className="grid max-h-48 gap-1 overflow-auto sm:grid-cols-2">
              {(query.data?.grades ?? []).map((g) => (
                <label key={g.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={gradeIds.includes(g.id)}
                    onChange={() =>
                      setGradeIds((prev) =>
                        prev.includes(g.id) ? prev.filter((id) => id !== g.id) : [...prev, g.id],
                      )
                    }
                  />
                  {g.name}
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Subjects</p>
            <div className="grid max-h-48 gap-1 overflow-auto sm:grid-cols-2">
              {(query.data?.subjects ?? []).map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={subjectIds.includes(s.id)}
                    onChange={() =>
                      setSubjectIds((prev) =>
                        prev.includes(s.id) ? prev.filter((id) => id !== s.id) : [...prev, s.id],
                      )
                    }
                  />
                  {s.name}
                </label>
              ))}
            </div>
            <PrimaryButton
              className="mt-3"
              type="button"
              disabled={!gradeIds.length || save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending ? 'Saving…' : 'Apply bulk mapping'}
            </PrimaryButton>
          </div>
        </AcademicCard>
      ) : null}
      <input
        className={`${fieldClass} max-w-sm`}
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Search class, subject or teacher"
      />
      {query.isLoading ? <SkeletonRows /> : null}
      {!query.isLoading && !rows.length ? (
        <EmptyState
          title="No mappings yet"
          hint="Select classes and subjects, then apply bulk mapping."
        />
      ) : null}
      {rows.length ? (
        <AcademicTable>
          <thead>
            <tr>
              <Th>Class</Th>
              <Th>Section</Th>
              <Th>Subject</Th>
              <Th>Type</Th>
              <Th>Subject teacher</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={`${row.sectionId}-${row.subjectId ?? i}`} className="border-t">
                <Td>{row.className}</Td>
                <Td>{row.sectionName}</Td>
                <Td>{row.subjectName ?? '—'}</Td>
                <Td>{row.subjectType ?? '—'}</Td>
                <Td>{row.teacher?.fullName ?? 'Unassigned'}</Td>
              </tr>
            ))}
          </tbody>
        </AcademicTable>
      ) : null}
    </div>
  );
}

export function AcademicStaffPanel() {
  const enabled = useAuthQueryEnabled();
  const canManage = canManageSchoolSis(useAuthStore((s) => s.session?.user)?.permissions);
  const qc = useQueryClient();
  const map = useQuery({ queryKey: ['school-staff-map'], queryFn: fetchSchoolStaffMap, enabled });
  const masters = useQuery({
    queryKey: ['school-sis-masters'],
    queryFn: fetchSchoolSisMasters,
    enabled,
  });
  const [error, setError] = useState<string | null>(null);
  const [classForm, setClassForm] = useState({ sectionId: '', staffId: '' });
  const [subjectForm, setSubjectForm] = useState({ sectionId: '', subjectId: '', staffId: '' });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['school-staff-map'] });
    void qc.invalidateQueries({ queryKey: ['school-sis-masters'] });
  };

  return (
    <div className="space-y-5">
      <AcademicPageHeader
        title="Class-wise staff"
        description="A teacher can be class teacher of only one section. Workload counts class teacher posts, subjects and periods."
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {canManage ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <AcademicCard>
            <h2 className="mb-3 text-sm font-semibold">Class teacher</h2>
            <form
              className="grid gap-2 sm:grid-cols-3"
              onSubmit={(e) => {
                e.preventDefault();
                void assignSchoolSisClassTeacher(classForm)
                  .then(() => {
                    setError(null);
                    refresh();
                  })
                  .catch((err) => setError(apiErrorMessage(err)));
              }}
            >
              <select
                className={fieldClass}
                value={classForm.sectionId}
                onChange={(e) => setClassForm({ ...classForm, sectionId: e.target.value })}
              >
                <option value="">Section</option>
                {(masters.data?.sections ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.grade.name} {s.name}
                  </option>
                ))}
              </select>
              <select
                className={fieldClass}
                value={classForm.staffId}
                onChange={(e) => setClassForm({ ...classForm, staffId: e.target.value })}
              >
                <option value="">Teacher</option>
                {(map.data?.staff ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName}
                  </option>
                ))}
              </select>
              <PrimaryButton type="submit">Save</PrimaryButton>
            </form>
          </AcademicCard>
          <AcademicCard>
            <h2 className="mb-3 text-sm font-semibold">Subject teacher</h2>
            <form
              className="grid gap-2 sm:grid-cols-4"
              onSubmit={(e) => {
                e.preventDefault();
                void assignSchoolSisSubjectTeacher(subjectForm)
                  .then(() => {
                    setError(null);
                    refresh();
                  })
                  .catch((err) => setError(apiErrorMessage(err)));
              }}
            >
              <select
                className={fieldClass}
                value={subjectForm.sectionId}
                onChange={(e) => setSubjectForm({ ...subjectForm, sectionId: e.target.value })}
              >
                <option value="">Section</option>
                {(masters.data?.sections ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.grade.name} {s.name}
                  </option>
                ))}
              </select>
              <select
                className={fieldClass}
                value={subjectForm.subjectId}
                onChange={(e) => setSubjectForm({ ...subjectForm, subjectId: e.target.value })}
              >
                <option value="">Subject</option>
                {(masters.data?.subjects ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                className={fieldClass}
                value={subjectForm.staffId}
                onChange={(e) => setSubjectForm({ ...subjectForm, staffId: e.target.value })}
              >
                <option value="">Teacher</option>
                {(map.data?.staff ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName}
                  </option>
                ))}
              </select>
              <PrimaryButton type="submit">Save</PrimaryButton>
            </form>
          </AcademicCard>
        </div>
      ) : null}
      {map.isLoading ? (
        <SkeletonRows />
      ) : (
        <AcademicTable>
          <thead>
            <tr>
              <Th>Teacher</Th>
              <Th>Class teacher</Th>
              <Th>Subjects</Th>
              <Th>Periods / week</Th>
            </tr>
          </thead>
          <tbody>
            {(map.data?.workload ?? []).map((row) => (
              <tr key={row.id} className="border-t">
                <Td className="font-medium">{row.fullName}</Td>
                <Td>{row.classTeacherSections}</Td>
                <Td>{row.subjects}</Td>
                <Td>{row.periods}</Td>
              </tr>
            ))}
          </tbody>
        </AcademicTable>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <AcademicCard>
          <h2 className="mb-2 text-sm font-semibold">Class teachers</h2>
          <ul className="space-y-1 text-sm">
            {(map.data?.classTeachers ?? []).map((row) => (
              <li key={row.id}>
                {row.section.grade.name} {row.section.name} — {row.staff.fullName}
              </li>
            ))}
          </ul>
        </AcademicCard>
        <AcademicCard>
          <h2 className="mb-2 text-sm font-semibold">Subject teachers</h2>
          <ul className="max-h-80 space-y-1 overflow-auto text-sm">
            {(map.data?.subjectTeachers ?? []).map((row) => (
              <li key={row.id}>
                {row.section.grade.name} {row.section.name} · {row.subject.name} —{' '}
                {row.staff.fullName}
              </li>
            ))}
          </ul>
        </AcademicCard>
      </div>
    </div>
  );
}
