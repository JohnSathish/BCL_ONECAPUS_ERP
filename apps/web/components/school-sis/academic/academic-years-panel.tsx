'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { canManageSchoolSis } from '@/lib/school-sis/permissions';
import {
  activateSchoolAcademicYear,
  archiveSchoolAcademicYear,
  fetchSchoolAcademicYears,
  saveSchoolAcademicYear,
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

export function AcademicYearsPanel() {
  const enabled = useAuthQueryEnabled();
  const canManage = canManageSchoolSis(useAuthStore((s) => s.session?.user)?.permissions);
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['school-academic-years'],
    queryFn: fetchSchoolAcademicYears,
    enabled,
  });
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    code: '',
    startDate: '',
    endDate: '',
    status: 'UPCOMING',
  });
  const rows = useMemo(() => query.data ?? [], [query.data]);
  const save = useMutation({
    mutationFn: () => saveSchoolAcademicYear(form, editing ?? undefined),
    onSuccess: () => {
      setError(null);
      setEditing(null);
      setForm({ name: '', code: '', startDate: '', endDate: '', status: 'UPCOMING' });
      void qc.invalidateQueries({ queryKey: ['school-academic-years'] });
      void qc.invalidateQueries({ queryKey: ['school-sis-overview'] });
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  return (
    <div className="space-y-5">
      <AcademicPageHeader
        title="Academic Year"
        description="Only one year can be current. Archiving keeps enrolments, marks and timetables."
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {canManage ? (
        <AcademicCard>
          <form
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <Field label="Year name">
              <input
                className={fieldClass}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="2026-27"
                required
              />
            </Field>
            <Field label="Code">
              <input
                className={fieldClass}
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="2026"
              />
            </Field>
            <Field label="Starts">
              <input
                type="date"
                className={fieldClass}
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                required
              />
            </Field>
            <Field label="Ends">
              <input
                type="date"
                className={fieldClass}
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                required
              />
            </Field>
            <div className="flex items-end gap-2">
              <PrimaryButton type="submit" disabled={save.isPending}>
                {editing ? 'Save year' : 'Add year'}
              </PrimaryButton>
              {editing ? (
                <GhostButton type="button" onClick={() => setEditing(null)}>
                  Cancel
                </GhostButton>
              ) : null}
            </div>
          </form>
        </AcademicCard>
      ) : null}
      {query.isLoading ? <SkeletonRows /> : null}
      {!query.isLoading && !rows.length ? (
        <EmptyState title="No academic years" hint="Add 2026-27 and set it as current." />
      ) : null}
      {rows.length ? (
        <AcademicTable>
          <thead>
            <tr>
              <Th>Year</Th>
              <Th>Dates</Th>
              <Th>Status</Th>
              <Th>Students</Th>
              <Th>Sections</Th>
              {canManage ? <Th>Actions</Th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t">
                <Td>
                  <div className="font-medium">{row.name}</div>
                  <div className="text-xs text-slate-400">{row.code}</div>
                </Td>
                <Td className="whitespace-nowrap text-slate-600">
                  {row.startDate.slice(0, 10)} → {row.endDate.slice(0, 10)}
                </Td>
                <Td>
                  <StatusBadge value={row.status} />
                </Td>
                <Td>{row._count?.enrollments ?? 0}</Td>
                <Td>{row._count?.sections ?? 0}</Td>
                {canManage ? (
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      <GhostButton
                        type="button"
                        onClick={() => {
                          setEditing(row.id);
                          setForm({
                            name: row.name,
                            code: row.code,
                            startDate: row.startDate.slice(0, 10),
                            endDate: row.endDate.slice(0, 10),
                            status: row.status,
                          });
                        }}
                      >
                        Edit
                      </GhostButton>
                      {row.status !== 'CURRENT' ? (
                        <GhostButton
                          type="button"
                          onClick={() => {
                            if (!confirmAction(`Make ${row.name} the current academic year?`))
                              return;
                            void activateSchoolAcademicYear(row.id)
                              .then(() =>
                                qc.invalidateQueries({ queryKey: ['school-academic-years'] }),
                              )
                              .catch((err) => setError(apiErrorMessage(err)));
                          }}
                        >
                          Set current
                        </GhostButton>
                      ) : null}
                      {row.status !== 'ARCHIVED' && row.status !== 'CURRENT' ? (
                        <GhostButton
                          type="button"
                          onClick={() => {
                            if (
                              !confirmAction(`Archive ${row.name}? Records stay in the database.`)
                            )
                              return;
                            void archiveSchoolAcademicYear(row.id)
                              .then(() =>
                                qc.invalidateQueries({ queryKey: ['school-academic-years'] }),
                              )
                              .catch((err) => setError(apiErrorMessage(err)));
                          }}
                        >
                          Archive
                        </GhostButton>
                      ) : null}
                    </div>
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
