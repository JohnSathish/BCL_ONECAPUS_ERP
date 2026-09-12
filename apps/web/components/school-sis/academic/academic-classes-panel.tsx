'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { canManageSchoolSis } from '@/lib/school-sis/permissions';
import {
  archiveSchoolSection,
  createSchoolSisSection,
  fetchSchoolAcademicClasses,
  patchSchoolSection,
  saveSchoolGrade,
} from '@/services/school-sis';
import { apiErrorMessage } from '@/utils/api-error';
import {
  AcademicCard,
  AcademicPageHeader,
  AcademicTable,
  EmptyState,
  Field,
  GhostButton,
  PrimaryButton,
  SkeletonRows,
  StatusBadge,
  Td,
  Th,
  confirmAction,
  fieldClass,
} from './academic-ui';

export function AcademicClassesPanel() {
  const enabled = useAuthQueryEnabled();
  const canManage = canManageSchoolSis(useAuthStore((s) => s.session?.user)?.permissions);
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['school-academic-classes'],
    queryFn: fetchSchoolAcademicClasses,
    enabled,
  });
  const [error, setError] = useState<string | null>(null);
  const [className, setClassName] = useState('');
  const [sectionGrade, setSectionGrade] = useState('');
  const [sectionName, setSectionName] = useState('A');
  const [capacity, setCapacity] = useState('40');
  const [q, setQ] = useState('');
  const refresh = () => qc.invalidateQueries({ queryKey: ['school-academic-classes'] });
  const addClass = useMutation({
    mutationFn: () => saveSchoolGrade({ name: className.trim() }),
    onSuccess: () => {
      setClassName('');
      setError(null);
      void refresh();
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });
  const addSection = useMutation({
    mutationFn: () =>
      createSchoolSisSection({
        gradeId: sectionGrade,
        name: sectionName,
        capacity: Number(capacity) || undefined,
      }),
    onSuccess: () => {
      setError(null);
      void refresh();
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });
  const sections = useMemo(() => {
    const list = query.data?.sections ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return list;
    return list.filter((s) => `${s.grade.name} ${s.name}`.toLowerCase().includes(term));
  }, [query.data, q]);

  return (
    <div className="space-y-5">
      <AcademicPageHeader
        title="Classes & sections"
        description={`Session ${query.data?.academicYear.name ?? '—'}. Capacity, class teacher and student count for the current year.`}
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {canManage ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <AcademicCard>
            <h2 className="mb-3 text-sm font-semibold">New class</h2>
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                addClass.mutate();
              }}
            >
              <input
                className={`${fieldClass} max-w-xs`}
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="Class 8"
                required
              />
              <PrimaryButton type="submit" disabled={addClass.isPending}>
                Add class
              </PrimaryButton>
            </form>
          </AcademicCard>
          <AcademicCard>
            <h2 className="mb-3 text-sm font-semibold">New section</h2>
            <form
              className="grid gap-2 sm:grid-cols-4"
              onSubmit={(e) => {
                e.preventDefault();
                addSection.mutate();
              }}
            >
              <select
                className={fieldClass}
                value={sectionGrade}
                onChange={(e) => setSectionGrade(e.target.value)}
                required
              >
                <option value="">Class</option>
                {(query.data?.grades ?? []).map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <input
                className={fieldClass}
                value={sectionName}
                onChange={(e) => setSectionName(e.target.value)}
                placeholder="A"
              />
              <input
                className={fieldClass}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="Capacity"
              />
              <PrimaryButton type="submit" disabled={addSection.isPending}>
                Add section
              </PrimaryButton>
            </form>
          </AcademicCard>
        </div>
      ) : null}
      <input
        className={`${fieldClass} max-w-sm`}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search class / section"
      />
      {query.isLoading ? <SkeletonRows /> : null}
      {!query.isLoading && !sections.length ? (
        <EmptyState title="No sections" hint="Add a class, then a section for this year." />
      ) : null}
      {sections.length ? (
        <AcademicTable>
          <thead>
            <tr>
              <Th>Class</Th>
              <Th>Section</Th>
              <Th>Capacity</Th>
              <Th>Students</Th>
              <Th>Class teacher</Th>
              <Th>Status</Th>
              {canManage ? <Th></Th> : null}
            </tr>
          </thead>
          <tbody>
            {sections.map((row) => (
              <tr key={row.id} className="border-t">
                <Td className="font-medium">{row.grade.name}</Td>
                <Td>{row.name}</Td>
                <Td>{row.capacity ?? '—'}</Td>
                <Td>{row._count?.enrollments ?? 0}</Td>
                <Td>{row.classTeachers?.[0]?.staff.fullName ?? '—'}</Td>
                <Td>
                  <StatusBadge value={row.active === false ? 'INACTIVE' : 'ACTIVE'} />
                </Td>
                {canManage ? (
                  <Td>
                    <GhostButton
                      type="button"
                      onClick={() => {
                        const next = window.prompt('Capacity', String(row.capacity ?? 40));
                        if (!next) return;
                        void patchSchoolSection(row.id, { capacity: Number(next) })
                          .then(() => refresh())
                          .catch((err) => setError(apiErrorMessage(err)));
                      }}
                    >
                      Capacity
                    </GhostButton>
                    <GhostButton
                      type="button"
                      onClick={() => {
                        if (
                          !confirmAction(
                            `Archive section ${row.grade.name} ${row.name}? Students stay on record.`,
                          )
                        )
                          return;
                        void archiveSchoolSection(row.id)
                          .then(() => refresh())
                          .catch((err) => setError(apiErrorMessage(err)));
                      }}
                    >
                      Archive
                    </GhostButton>
                  </Td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </AcademicTable>
      ) : null}
    </div>
  );
}
