'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { SchoolSisTimetableGrid } from '@/components/school-sis/school-sis-timetable-grid';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { canManageSchoolSis } from '@/lib/school-sis/permissions';
import {
  copySchoolSisTimetable,
  fetchSchoolSisClassTimetable,
  fetchSchoolSisMasters,
  fetchSchoolSisStaff,
  publishSchoolSisTimetable,
  validateSchoolSisTimetable,
} from '@/services/school-sis';
import { apiErrorMessage } from '@/utils/api-error';
import { TimetableChrome } from '@/components/school-sis/timetable/tt-chrome';

export function SchoolSisClassTimetable() {
  const enabled = useAuthQueryEnabled();
  const user = useAuthStore((s) => s.session?.user);
  const canEdit = canManageSchoolSis(user?.permissions);
  const [sectionId, setSectionId] = useState('');
  const [copyTo, setCopyTo] = useState('');
  const [copyDayFrom, setCopyDayFrom] = useState(1);
  const [copyDayTo, setCopyDayTo] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const masters = useQuery({
    queryKey: ['school-sis-masters'],
    queryFn: fetchSchoolSisMasters,
    enabled,
  });
  const staff = useQuery({ queryKey: ['school-sis-staff'], queryFn: fetchSchoolSisStaff, enabled });
  const sections = masters.data?.sections ?? [];
  const activeSection = sectionId || sections[0]?.id || '';

  const grid = useQuery({
    queryKey: ['school-sis-timetable-class', activeSection],
    queryFn: () => fetchSchoolSisClassTimetable(activeSection),
    enabled: enabled && Boolean(activeSection),
  });

  const copy = useMutation({
    mutationFn: () =>
      copySchoolSisTimetable({
        mode: 'WEEK',
        fromSectionId: activeSection,
        toSectionId: copyTo,
      }),
    onSuccess: () => {
      setError(null);
      setSummary('Timetable copied. Review the destination section before publishing.');
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });
  const publish = useMutation({
    mutationFn: publishSchoolSisTimetable,
    onSuccess: () => {
      setError(null);
      setSummary('Timetable published. Students, parents and teachers will see this version.');
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });
  const validate = useMutation({
    mutationFn: validateSchoolSisTimetable,
    onSuccess: (data) => {
      setError(null);
      setSummary(
        `${data.validEntries} entries · ${data.teacherConflicts.length} teacher conflicts · ${data.roomConflicts.length} room conflicts · ${data.missingTeachers.length} missing teachers`,
      );
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const teachers = useMemo(
    () => (staff.data ?? []).filter((s) => s.staffType === 'TEACHING' && s.status === 'ACTIVE'),
    [staff.data],
  );
  const subjects = masters.data?.subjects ?? [];
  const section = grid.data?.section;
  const printTitle = section ? `${section.grade.name} ${section.name}` : 'Class timetable';
  const printSub = `Academic Year: ${grid.data?.academicYear.name ?? masters.data?.academicYear.name ?? ''} · Status: ${grid.data?.plan?.status ?? 'DRAFT'}`;

  return (
    <TimetableChrome
      title="Class-wise timetable"
      hint="Select a class, then a period cell. Subject and teacher come from dropdowns. Drag a lesson to another period. Conflicts are not saved."
      actions={
        canEdit ? (
          <button
            type="button"
            className="rounded-xl bg-[#1a365d] px-4 py-2 text-sm text-white"
            onClick={() => publish.mutate()}
          >
            Publish week
          </button>
        ) : null
      }
    >
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <label className="text-xs font-semibold text-slate-500">
          Class & section
          <select
            className="mt-1 block h-10 min-w-[220px] rounded-lg border px-3 text-sm"
            value={activeSection}
            onChange={(e) => setSectionId(e.target.value)}
          >
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.grade.name} {s.name}
              </option>
            ))}
          </select>
        </label>
        {canEdit ? (
          <>
            <label className="text-xs font-semibold text-slate-500">
              Copy to
              <select
                className="mt-1 block h-10 min-w-[180px] rounded-lg border px-3 text-sm"
                value={copyTo}
                onChange={(e) => setCopyTo(e.target.value)}
              >
                <option value="">Select section</option>
                {sections
                  .filter((s) => s.id !== activeSection)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.grade.name} {s.name}
                    </option>
                  ))}
              </select>
            </label>
            <button
              type="button"
              className="h-10 rounded-xl border px-3 text-sm"
              disabled={!copyTo || copy.isPending}
              onClick={() => {
                if (window.confirm('Replace the destination class timetable with this week?'))
                  copy.mutate();
              }}
            >
              Copy week to class
            </button>
            <label className="text-xs font-semibold text-slate-500">
              Copy day
              <span className="mt-1 flex gap-2">
                <select
                  className="h-10 rounded-lg border px-2 text-sm"
                  value={copyDayFrom}
                  onChange={(e) => setCopyDayFrom(Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5].map((d) => (
                    <option key={d} value={d}>
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][d - 1]}
                    </option>
                  ))}
                </select>
                <select
                  className="h-10 rounded-lg border px-2 text-sm"
                  value={copyDayTo}
                  onChange={(e) => setCopyDayTo(Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5].map((d) => (
                    <option key={d} value={d}>
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][d - 1]}
                    </option>
                  ))}
                </select>
              </span>
            </label>
            <button
              type="button"
              className="h-10 rounded-xl border px-3 text-sm"
              onClick={() => {
                void copySchoolSisTimetable({
                  mode: 'DAY',
                  fromSectionId: activeSection,
                  fromDay: copyDayFrom,
                  toDay: copyDayTo,
                })
                  .then(() => {
                    setSummary('Day copied. Review before publishing.');
                    void grid.refetch();
                  })
                  .catch((err) => setError(apiErrorMessage(err)));
              }}
            >
              Copy day
            </button>
            <button
              type="button"
              className="h-10 rounded-xl border px-3 text-sm"
              onClick={() => validate.mutate()}
            >
              Validate
            </button>
            <button
              type="button"
              className="h-10 rounded-xl bg-[#2563eb] px-3 text-sm font-semibold text-white"
              onClick={() => publish.mutate()}
              disabled={publish.isPending}
            >
              Publish
            </button>
          </>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {summary ? <p className="text-sm text-sky-800">{summary}</p> : null}

      {grid.isLoading ? <p className="text-sm text-slate-500">Loading timetable…</p> : null}
      {grid.data ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {printTitle} · {printSub}
          </p>
          <SchoolSisTimetableGrid
            grid={grid.data}
            canEdit={canEdit}
            subjects={subjects}
            staff={teachers}
            queryKey={['school-sis-timetable-class', activeSection]}
            printTitle={printTitle}
            printSub={printSub}
          />
        </div>
      ) : null}
    </TimetableChrome>
  );
}
