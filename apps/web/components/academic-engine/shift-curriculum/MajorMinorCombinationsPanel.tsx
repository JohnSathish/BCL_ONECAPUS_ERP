'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/erp/data-table';
import {
  fetchAcademicSubjects,
  fetchMajorMinorMatrix,
  fetchMajorMinorRules,
  fetchShifts,
  syncMajorMinorRules,
  setMajorMinorRuleActive,
  type MajorMinorRuleRow,
} from '@/services/academic-engine';
import { fetchAcademicYears, fetchInstitutions } from '@/services/organization';

type Props = {
  institutionId?: string;
  initialShiftId?: string;
};

export function MajorMinorCombinationsPanel({ institutionId, initialShiftId }: Props) {
  const qc = useQueryClient();
  const [shiftId, setShiftId] = useState(initialShiftId ?? '');
  const [majorSubjectId, setMajorSubjectId] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [selectedMinorIds, setSelectedMinorIds] = useState<string[]>([]);
  const [filterMajorId, setFilterMajorId] = useState('');

  const institutions = useQuery({
    queryKey: ['organization', 'institutions'],
    queryFn: fetchInstitutions,
  });
  const resolvedInstitutionId = institutionId ?? institutions.data?.[0]?.id ?? '';

  const shifts = useQuery({
    queryKey: ['academic-engine', 'shifts', 'ACTIVE'],
    queryFn: () => fetchShifts(),
  });

  const academicYears = useQuery({
    queryKey: ['organization', 'academic-years'],
    queryFn: fetchAcademicYears,
  });

  const subjects = useQuery({
    queryKey: ['academic-engine', 'subjects', resolvedInstitutionId],
    queryFn: () => fetchAcademicSubjects(resolvedInstitutionId),
    enabled: Boolean(resolvedInstitutionId),
  });

  const officialMatrix = useQuery({
    queryKey: ['major-minor-matrix'],
    queryFn: fetchMajorMinorMatrix,
  });

  const activeShiftId = shiftId || shifts.data?.find((s) => s.status === 'ACTIVE')?.id || '';

  const rules = useQuery({
    queryKey: ['major-minor-rules', resolvedInstitutionId, activeShiftId, filterMajorId],
    queryFn: () =>
      fetchMajorMinorRules({
        institutionId: resolvedInstitutionId,
        shiftId: activeShiftId || undefined,
        majorSubjectId: filterMajorId || undefined,
      }),
    enabled: Boolean(resolvedInstitutionId),
  });

  const matrixMajors = useMemo(() => {
    const majorNames = new Set(Object.keys(officialMatrix.data ?? {}));
    return (subjects.data ?? [])
      .filter((subject) => majorNames.has(subject.name))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [subjects.data, officialMatrix.data]);

  const selectedMajor = matrixMajors.find((subject) => subject.id === majorSubjectId);

  const officialMinorNames = useMemo(() => {
    if (!selectedMajor) return [];
    return officialMatrix.data?.[selectedMajor.name] ?? [];
  }, [officialMatrix.data, selectedMajor]);

  const minorOptions = useMemo(() => {
    const byName = new Map((subjects.data ?? []).map((subject) => [subject.name, subject]));
    return officialMinorNames
      .map((name) => byName.get(name))
      .filter((subject): subject is NonNullable<typeof subject> => Boolean(subject));
  }, [officialMinorNames, subjects.data]);

  useEffect(() => {
    if (!majorSubjectId) {
      setSelectedMinorIds([]);
      return;
    }
    const activeMinors = (rules.data ?? [])
      .filter((rule) => {
        if (rule.majorSubjectId !== majorSubjectId || !rule.isActive) return false;
        const shiftOk = !activeShiftId
          ? rule.shiftId == null
          : rule.shiftId === activeShiftId || rule.shiftId == null;
        const yearOk = academicYearId
          ? rule.academicYearId === academicYearId
          : rule.academicYearId == null;
        return shiftOk && yearOk;
      })
      .map((rule) => rule.allowedMinorSubjectId);
    setSelectedMinorIds(activeMinors);
  }, [majorSubjectId, rules.data, activeShiftId, academicYearId]);

  const groupedRules = useMemo(() => {
    const map = new Map<
      string,
      { major: MajorMinorRuleRow['majorSubject']; minors: MajorMinorRuleRow[] }
    >();
    for (const rule of rules.data ?? []) {
      const key = rule.majorSubjectId;
      const entry = map.get(key) ?? { major: rule.majorSubject, minors: [] };
      entry.minors.push(rule);
      map.set(key, entry);
    }
    return [...map.values()].sort((a, b) => a.major.name.localeCompare(b.major.name));
  }, [rules.data]);

  const saveRules = useMutation({
    mutationFn: () =>
      syncMajorMinorRules({
        majorSubjectId,
        allowedMinorSubjectIds: selectedMinorIds,
        shiftId: activeShiftId || null,
        academicYearId: academicYearId || null,
        isActive: true,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['major-minor-rules'] });
    },
  });

  const toggleRule = useMutation({
    mutationFn: ({ ruleId, isActive }: { ruleId: string; isActive: boolean }) =>
      setMajorMinorRuleActive(ruleId, isActive),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['major-minor-rules'] });
    },
  });

  const loadMajorForEdit = (majorId: string) => {
    setMajorSubjectId(majorId);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Major–Minor combinations</CardTitle>
          <CardDescription>
            Configure allowed minor subjects per major for each shift. Options follow the official
            NEHU FYUGP matrix (Arts, Science, and Commerce). Used by bulk import Excel dropdowns,
            subject registration, and import validation.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <label className="block text-sm font-medium">
            Shift
            <select
              className="mt-1 h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
              value={activeShiftId}
              onChange={(e) => setShiftId(e.target.value)}
            >
              <option value="">All shifts (global rules)</option>
              {(shifts.data ?? [])
                .filter((s) => s.status === 'ACTIVE')
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            Academic year (optional)
            <select
              className="mt-1 h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
              value={academicYearId}
              onChange={(e) => setAcademicYearId(e.target.value)}
            >
              <option value="">All years</option>
              {(academicYears.data ?? []).map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium lg:col-span-2">
            Major subject
            <select
              className="mt-1 h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
              value={majorSubjectId}
              onChange={(e) => setMajorSubjectId(e.target.value)}
            >
              <option value="">Select major</option>
              {matrixMajors.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </label>
          {selectedMajor && officialMinorNames.length > 0 ? (
            <p className="text-sm text-muted-foreground lg:col-span-2">
              Official NEHU minors for {selectedMajor.name}: {officialMinorNames.join(', ')}
            </p>
          ) : null}
          <div className="lg:col-span-2">
            <p className="mb-2 text-sm font-medium">Allowed minor subjects</p>
            {!majorSubjectId ? (
              <p className="text-sm text-muted-foreground">Select a major to configure minors.</p>
            ) : minorOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No minor subjects found in the catalog for this major. Run database seed to sync
                academic subjects.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                {minorOptions.map((minor) => (
                  <label key={minor.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedMinorIds.includes(minor.id)}
                      onChange={(e) => {
                        setSelectedMinorIds((current) =>
                          e.target.checked
                            ? [...current, minor.id]
                            : current.filter((id) => id !== minor.id),
                        );
                      }}
                    />
                    {minor.name}
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 lg:col-span-2">
            <Button
              size="sm"
              disabled={!majorSubjectId || saveRules.isPending}
              onClick={() => saveRules.mutate()}
            >
              Save combination
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configured mappings</CardTitle>
          <CardDescription>
            Active rules per major. Global rules apply to all shifts unless overridden for a
            specific shift.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="block max-w-md text-sm font-medium">
            Filter by major
            <select
              className="mt-1 h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
              value={filterMajorId}
              onChange={(e) => setFilterMajorId(e.target.value)}
            >
              <option value="">All majors</option>
              {matrixMajors.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </label>

          {groupedRules.map(({ major, minors }) => (
            <div key={major.id} className="rounded-md border border-border p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{major.name}</p>
                <Button size="sm" variant="outline" onClick={() => loadMajorForEdit(major.id)}>
                  Edit
                </Button>
              </div>
              <ul className="space-y-1 text-sm">
                {minors.map((rule) => (
                  <li key={rule.id} className="flex flex-wrap items-center gap-2">
                    <span className={rule.isActive ? '' : 'text-muted-foreground line-through'}>
                      {rule.allowedMinorSubject.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {rule.shift?.code ?? 'Global'}
                      {rule.academicYear ? ` · ${rule.academicYear.name}` : ''}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() =>
                        toggleRule.mutate({ ruleId: rule.id, isActive: !rule.isActive })
                      }
                    >
                      {rule.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Updated {new Date(rule.updatedAt).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {!groupedRules.length ? (
            <p className="text-sm text-muted-foreground">No major–minor rules configured yet.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit log</CardTitle>
          <CardDescription>Created and updated timestamps for each rule row.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            rows={rules.data ?? []}
            getRowKey={(row) => row.id}
            columns={[
              {
                key: 'major',
                header: 'Major',
                cell: (row) => row.majorSubject.name,
              },
              {
                key: 'minor',
                header: 'Minor',
                cell: (row) => row.allowedMinorSubject.name,
              },
              {
                key: 'shift',
                header: 'Shift',
                cell: (row) => row.shift?.code ?? 'Global',
              },
              {
                key: 'active',
                header: 'Active',
                cell: (row) => (row.isActive ? 'Yes' : 'No'),
              },
              {
                key: 'created',
                header: 'Created',
                cell: (row) => new Date(row.createdAt).toLocaleString(),
              },
              {
                key: 'updated',
                header: 'Updated',
                cell: (row) => new Date(row.updatedAt).toLocaleString(),
              },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
