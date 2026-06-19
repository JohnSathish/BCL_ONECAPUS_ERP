'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, User } from 'lucide-react';
import { fetchShifts } from '@/services/shifts';
import { fetchPrograms, fetchProgramVersions } from '@/services/programs';
import { fetchStudents } from '@/services/students';
import type { FeeDemandScope } from '@/services/fees';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/utils/cn';

type StudentRow = {
  id: string;
  enrollmentNumber?: string | null;
  fullName?: string | null;
  masterProfile?: { fullName?: string | null } | null;
};

export function DemandScopeForm({
  scope,
  setScope,
  mode,
}: {
  scope: FeeDemandScope;
  setScope: React.Dispatch<React.SetStateAction<FeeDemandScope>>;
  mode: 'demands' | 'renewals';
}) {
  const [studentSearch, setStudentSearch] = useState('');
  const [studentResults, setStudentResults] = useState<StudentRow[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);
  const [programId, setProgramId] = useState('');

  const programsQ = useQuery({
    queryKey: ['programs', 'demand-scope'],
    queryFn: () => fetchPrograms(1, ''),
  });
  const versionsQ = useQuery({
    queryKey: ['program-versions', programId],
    queryFn: () => fetchProgramVersions(programId),
    enabled: Boolean(programId),
  });
  const shiftsQ = useQuery({
    queryKey: ['shifts', 'demand-scope'],
    queryFn: () => fetchShifts({ status: 'active' }),
  });

  const programs = programsQ.data?.data ?? [];
  const versions = versionsQ.data ?? [];
  const shifts = shiftsQ.data ?? [];

  useEffect(() => {
    if (!scope.studentId) {
      setSelectedStudent(null);
      return;
    }
    if (selectedStudent?.id === scope.studentId) return;
    void fetchStudents({ search: scope.studentId, limit: 1 }).then((res) => {
      const row = res.data[0];
      if (row?.id === scope.studentId) {
        setSelectedStudent(row as StudentRow);
        setStudentSearch(row.enrollmentNumber ?? row.fullName ?? '');
      }
    });
  }, [scope.studentId, selectedStudent?.id]);

  const billingOptions = useMemo(
    () =>
      mode === 'renewals'
        ? [{ value: 'YEARLY', label: 'Yearly (renewal)' }]
        : [
            { value: 'YEARLY', label: 'Yearly / session' },
            { value: 'MONTHLY', label: 'Monthly' },
            { value: 'BIENNIAL', label: 'Biennial (2 semesters)' },
          ],
    [mode],
  );

  const runStudentSearch = async () => {
    const q = studentSearch.trim();
    if (q.length < 2) {
      setStudentResults([]);
      return;
    }
    const res = await fetchStudents({ search: q, limit: 8 });
    setStudentResults(res.data as StudentRow[]);
  };

  const pickStudent = (row: StudentRow) => {
    setSelectedStudent(row);
    setStudentSearch(row.enrollmentNumber ?? row.fullName ?? '');
    setStudentResults([]);
    setScope((prev) => ({ ...prev, studentId: row.id }));
  };

  const clearStudent = () => {
    setSelectedStudent(null);
    setStudentSearch('');
    setScope((prev) => ({ ...prev, studentId: undefined }));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs leading-5 text-muted-foreground">
        <strong className="text-foreground">Tip:</strong> Leave student blank to generate for all
        students matching programme / shift / semester. Always run <em>Preview</em> first —
        duplicates and students with no matching published structure are flagged.
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Student (optional — single student)</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="Enrollment no, name, mobile…"
            value={studentSearch}
            onChange={(e) => setStudentSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void runStudentSearch()}
            onBlur={() => setTimeout(() => setStudentResults([]), 150)}
          />
        </div>
        {studentResults.length > 0 && (
          <ul className="max-h-40 overflow-auto rounded-xl border border-border bg-popover text-sm shadow-md">
            {studentResults.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted"
                  onMouseDown={() => pickStudent(row)}
                >
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{row.fullName ?? 'Student'}</span>
                  <span className="text-xs text-muted-foreground">{row.enrollmentNumber}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {selectedStudent && (
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
            <span>
              {selectedStudent.masterProfile?.fullName} · {selectedStudent.enrollmentNumber}
            </span>
            <button type="button" className="text-xs text-primary" onClick={clearStudent}>
              Clear
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Programme</Label>
          <select
            className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
            value={programId}
            onChange={(e) => {
              setProgramId(e.target.value);
              setScope((prev) => ({ ...prev, programVersionId: undefined }));
            }}
          >
            <option value="">All programmes</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Programme version</Label>
          <select
            className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
            value={scope.programVersionId ?? ''}
            disabled={!programId}
            onChange={(e) =>
              setScope((prev) => ({
                ...prev,
                programVersionId: e.target.value || undefined,
              }))
            }
          >
            <option value="">All versions</option>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                v{v.version} · {v.status}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Shift</Label>
          <select
            className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
            value={scope.shiftId ?? ''}
            onChange={(e) =>
              setScope((prev) => ({ ...prev, shiftId: e.target.value || undefined }))
            }
          >
            <option value="">All shifts</option>
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Semester number</Label>
          <Input
            type="number"
            min={1}
            max={8}
            value={scope.semesterNumber ?? 1}
            onChange={(e) =>
              setScope((prev) => ({ ...prev, semesterNumber: Number(e.target.value) || 1 }))
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Billing layer</Label>
          <select
            className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
            value={scope.billingLayer ?? 'YEARLY'}
            disabled={mode === 'renewals'}
            onChange={(e) => setScope((prev) => ({ ...prev, billingLayer: e.target.value }))}
          >
            {billingOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Demand type</Label>
          <select
            className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
            value={scope.demandType ?? 'GENERAL'}
            onChange={(e) => setScope((prev) => ({ ...prev, demandType: e.target.value }))}
          >
            <option value="GENERAL">General</option>
            <option value="ADMISSION">Admission</option>
            <option value="RENEWAL">Renewal</option>
            <option value="MONTHLY_TUITION">Monthly tuition</option>
          </select>
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="rounded border-border"
          checked={Boolean(scope.publish)}
          onChange={(e) => setScope((prev) => ({ ...prev, publish: e.target.checked }))}
        />
        <span>
          Publish immediately{' '}
          <span className="text-xs text-muted-foreground">
            (visible to students & payment desk)
          </span>
        </span>
      </label>
    </div>
  );
}

export function PreviewSummary({
  preview,
}: {
  preview?: {
    studentCount: number;
    duplicateCount: number;
    totalAmount: number;
    rows: Array<{ lines: unknown[] }>;
  };
}) {
  if (!preview) return null;
  const noLines = preview.rows.filter((r) => !r.lines?.length).length;
  return (
    <div className="mb-3 flex flex-wrap gap-2 text-xs">
      <span className="rounded-full bg-muted px-2.5 py-1">{preview.studentCount} students</span>
      <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-amber-800">
        {preview.duplicateCount} duplicates skipped
      </span>
      {noLines > 0 && (
        <span className="rounded-full bg-rose-500/10 px-2.5 py-1 text-rose-700">
          {noLines} with no fee lines (check published structures)
        </span>
      )}
    </div>
  );
}
