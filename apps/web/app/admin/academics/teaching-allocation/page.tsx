'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileDown, UploadCloud, Wand2 } from 'lucide-react';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  autoAssignTeachingAllocations,
  commitTeachingAllocationUpload,
  downloadTeachingAllocationTemplate,
  fetchTeachingAllocations,
  fetchTimetableContext,
  fetchTimetableReadiness,
  submitTeachingAllocations,
  validateTeachingAllocationUpload,
  type TeachingAllocationRow,
} from '@/services/timetable';
import { cn } from '@/utils/cn';
import { useAuthQueryEnabled, useRequireAuth } from '@/hooks/use-auth';

export default function TeachingAllocationPage() {
  useRequireAuth();
  const authReady = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [semesterMode, setSemesterMode] = useState<'ODD' | 'EVEN'>('ODD');
  const [streamId, setStreamId] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const contextQ = useQuery({
    queryKey: ['timetable', 'context'],
    queryFn: fetchTimetableContext,
    enabled: authReady,
  });
  const params = useMemo(
    () => ({
      semesterMode,
      streamId: streamId || undefined,
      shiftId: shiftId || undefined,
    }),
    [semesterMode, streamId, shiftId],
  );
  const rowsQ = useQuery({
    queryKey: ['timetable', 'teaching-allocations', params],
    queryFn: () => fetchTeachingAllocations(params),
    enabled: authReady,
  });
  const readinessQ = useQuery({
    queryKey: ['timetable', 'readiness', params],
    queryFn: () => fetchTimetableReadiness(params),
    enabled: authReady,
  });
  const rows = rowsQ.data ?? [];
  const selectedIds = rows.map((row) => row.offeringSectionId);
  const autoMut = useMutation({
    mutationFn: () => autoAssignTeachingAllocations(params),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timetable'] }),
  });
  const submitMut = useMutation({
    mutationFn: () => submitTeachingAllocations(selectedIds, 'SUBMITTED'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timetable'] }),
  });
  const downloadMut = useMutation({
    mutationFn: () => downloadTeachingAllocationTemplate(params),
    onSuccess: (blob) => saveBlob(blob, 'fyugp-teaching-allocation-template.xlsx'),
  });
  const validateMut = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('Choose an Excel file first');
      return validateTeachingAllocationUpload(file);
    },
  });
  const commitMut = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('Choose an Excel file first');
      return commitTeachingAllocationUpload(file);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timetable'] }),
  });
  return (
    <DashboardShell role="admin" title="Teaching Allocation">
      <div className="space-y-5">
        <section className="rounded-3xl border border-border/60 bg-gradient-to-br from-primary/15 via-card to-card p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">
            Department input layer
          </p>
          <h1 className="mt-2 text-2xl font-semibold">FYUGP Teaching Allocation</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            HODs provide faculty, initials, workload, rooms, lab, and combined-class inputs. The
            central timetable engine uses these rows to generate stream master routines.
          </p>
        </section>

        <Card>
          <CardContent className="grid gap-3 p-4 md:grid-cols-4">
            <select
              className="h-10 rounded-md border bg-card px-3 text-sm"
              value={semesterMode}
              onChange={(event) => setSemesterMode(event.target.value as 'ODD' | 'EVEN')}
            >
              <option value="ODD">ODD: Sem 1, 3, 5</option>
              <option value="EVEN">EVEN: Sem 2, 4, 6</option>
            </select>
            <select
              className="h-10 rounded-md border bg-card px-3 text-sm"
              value={streamId}
              onChange={(event) => setStreamId(event.target.value)}
            >
              <option value="">All Streams</option>
              {(contextQ.data?.streams ?? []).map((stream) => (
                <option key={stream.id} value={stream.id}>
                  {stream.name}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-md border bg-card px-3 text-sm"
              value={shiftId}
              onChange={(event) => setShiftId(event.target.value)}
            >
              <option value="">All Shifts</option>
              {(contextQ.data?.shifts ?? []).map((shift) => (
                <option key={shift.id} value={shift.id}>
                  {shift.name}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => downloadMut.mutate()}
                disabled={downloadMut.isPending}
              >
                <FileDown className="mr-2 h-4 w-4" />
                {downloadMut.isPending ? 'Preparing...' : 'Prefilled Excel'}
              </Button>
              <Button onClick={() => autoMut.mutate()} disabled={autoMut.isPending}>
                <Wand2 className="mr-2 h-4 w-4" />
                Auto Assign
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-4">
          <Metric label="Total Subjects" value={readinessQ.data?.totalSubjects ?? rows.length} />
          <Metric label="Blocking Issues" value={readinessQ.data?.blockingIssues ?? 0} tone="red" />
          <Metric label="Warnings" value={readinessQ.data?.warnings ?? 0} tone="yellow" />
          <Metric
            label="Ready"
            value={readinessQ.data?.readyForGeneration ? 'YES' : 'NO'}
            tone={readinessQ.data?.readyForGeneration ? 'green' : 'red'}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              Excel Upload
              <Button
                onClick={() => submitMut.mutate()}
                disabled={!rows.length || submitMut.isPending}
                size="sm"
              >
                Submit All Rows
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 md:flex-row md:items-center">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <Button
              variant="outline"
              onClick={() => validateMut.mutate()}
              disabled={!file || validateMut.isPending}
            >
              Validate Upload
            </Button>
            <Button onClick={() => commitMut.mutate()} disabled={!file || commitMut.isPending}>
              <UploadCloud className="mr-2 h-4 w-4" />
              Commit Valid Rows
            </Button>
            {validateMut.data ? (
              <span className="text-sm text-muted-foreground">
                Valid {validateMut.data.summary.valid} / {validateMut.data.summary.total}, invalid{' '}
                {validateMut.data.summary.invalid}
              </span>
            ) : null}
          </CardContent>
        </Card>

        <AllocationGrid rows={rows} />
      </div>
    </DashboardShell>
  );
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: 'green' | 'yellow' | 'red';
}) {
  return (
    <Card
      className={cn(
        tone === 'green' && 'border-emerald-500/40',
        tone === 'yellow' && 'border-amber-500/40',
        tone === 'red' && 'border-rose-500/40',
      )}
    >
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function AllocationGrid({ rows }: { rows: TeachingAllocationRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Department Assignment Grid</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr>
              {[
                'Department',
                'Sem',
                'Subject',
                'Paper',
                'Faculty',
                'Initial',
                'Hours',
                'Shift',
                'Room',
                'Lab',
                'Combined',
                'Status',
              ].map((head) => (
                <th key={head} className="border-b px-3 py-2">
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.offeringSectionId} className="border-b last:border-0">
                <td className="px-3 py-2">{row.department ?? '-'}</td>
                <td className="px-3 py-2">Sem {row.semester ?? '-'}</td>
                <td className="px-3 py-2">
                  <div className="font-medium">{row.subjectCode}</div>
                  <div className="text-xs text-muted-foreground">{row.subjectName}</div>
                </td>
                <td className="px-3 py-2">{row.paperType}</td>
                <td className="px-3 py-2">
                  <div>{row.staffName ?? 'Unassigned'}</div>
                  <div className="text-xs text-muted-foreground">{row.staffCode}</div>
                </td>
                <td className="px-3 py-2 font-semibold">{row.facultyInitial ?? '-'}</td>
                <td className="px-3 py-2">
                  <span
                    className={cn(
                      'rounded-full px-2 py-1 text-xs',
                      row.workloadStatus === 'RED' && 'bg-rose-500/10 text-rose-700',
                      row.workloadStatus === 'YELLOW' && 'bg-amber-500/10 text-amber-700',
                      row.workloadStatus === 'GREEN' && 'bg-emerald-500/10 text-emerald-700',
                    )}
                  >
                    {row.weeklyHours ?? 0}h
                  </span>
                </td>
                <td className="px-3 py-2">{row.shift ?? '-'}</td>
                <td className="px-3 py-2">{row.preferredRoom ?? '-'}</td>
                <td className="px-3 py-2">{row.labRequired ? 'Yes' : 'No'}</td>
                <td className="px-3 py-2">
                  {row.combinedClass ? row.combinedGroupId || 'Yes' : 'No'}
                </td>
                <td className="px-3 py-2">{row.status ?? 'PENDING'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
