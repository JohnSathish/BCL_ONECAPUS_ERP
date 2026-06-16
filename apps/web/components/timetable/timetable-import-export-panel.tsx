'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { FileDown, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  commitRoutineUpload,
  downloadRoutineTemplate,
  exportTimetableRoutine,
  fetchDraftRoomEntries,
  finalizeTimetableRooms,
  validateRoutineUpload,
} from '@/services/timetable';

type Props = {
  planId: string;
  onCommitted?: () => void;
};

export function TimetableImportExportPanel({ planId, onCommitted }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof validateRoutineUpload>> | null>(
    null,
  );

  const validateMut = useMutation({
    mutationFn: (upload: File) => validateRoutineUpload(planId, upload),
    onSuccess: (result) => setPreview(result),
  });

  const commitMut = useMutation({
    mutationFn: (options?: { overrideConflicts?: boolean }) =>
      commitRoutineUpload(planId, file!, options),
    onSuccess: () => {
      setFile(null);
      setPreview(null);
      onCommitted?.();
    },
  });

  const draftRoomsQ = useQuery({
    queryKey: ['timetable', 'draft-rooms', planId],
    queryFn: () => fetchDraftRoomEntries(planId),
    enabled: Boolean(planId),
  });

  const finalizeRoomsMut = useMutation({
    mutationFn: () => finalizeTimetableRooms(planId),
    onSuccess: () => {
      void draftRoomsQ.refetch();
      onCommitted?.();
    },
  });

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Excel Import / Export</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Download the routine template, fill slots offline, validate warnings, then commit to the
          draft plan.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!planId}
            onClick={async () => {
              const blob = await downloadRoutineTemplate(planId);
              downloadBlob(blob, 'timetable-routine-template.xlsx');
            }}
          >
            <FileDown className="mr-2 h-3.5 w-3.5" />
            Download Template
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!planId}
            onClick={async () => {
              const blob = await exportTimetableRoutine(planId, 'draft');
              downloadBlob(blob, 'timetable-draft-export.xlsx');
            }}
          >
            <FileDown className="mr-2 h-3.5 w-3.5" />
            Export Draft
          </Button>
        </div>
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-border p-8 text-center">
          <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
          <span className="text-sm font-medium">
            {file ? file.name : 'Drop Excel file or click to upload'}
          </span>
          <input
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(event) => {
              const next = event.target.files?.[0] ?? null;
              setFile(next);
              setPreview(null);
            }}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={!file || validateMut.isPending}
            onClick={() => file && validateMut.mutate(file)}
          >
            Validate Upload
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!file || !preview?.summary.canCommit || commitMut.isPending}
            onClick={() => commitMut.mutate(undefined)}
          >
            Commit (Skip Errors)
          </Button>
          <Button
            size="sm"
            disabled={!file || !preview?.summary.canCommit || commitMut.isPending}
            onClick={() => commitMut.mutate({ overrideConflicts: true })}
          >
            Override Warnings & Commit
          </Button>
        </div>
        {preview ? (
          <div className="space-y-2">
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <Stat label="Total" value={preview.summary.total} />
              <Stat label="Valid" value={preview.summary.success} />
              <Stat label="Warnings" value={preview.summary.warnings} />
              <Stat label="Errors" value={preview.summary.errors} />
            </div>
            <div className="max-h-64 overflow-auto rounded-xl border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-2 py-2 text-left">Row</th>
                    <th className="px-2 py-2 text-left">Group</th>
                    <th className="px-2 py-2 text-left">Subject</th>
                    <th className="px-2 py-2 text-left">Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 50).map((row, index) => (
                    <tr key={index} className="border-t border-border">
                      <td className="px-2 py-2">{String(row.rowNo ?? index + 2)}</td>
                      <td className="px-2 py-2">{String(row['Subject Group Code'] ?? '')}</td>
                      <td className="px-2 py-2">{String(row['Subject Code'] ?? '')}</td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {Array.isArray(row.issues)
                          ? (row.issues as Array<{ level: string; message: string }>)
                              .map((issue) => issue.message)
                              .join('; ')
                          : 'OK'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
        <div className="rounded-xl border border-border/70 p-3">
          <p className="text-sm font-medium">Draft → Final Rooms</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {(draftRoomsQ.data ?? []).length} slot(s) still missing a finalized room assignment.
            Import faculty/subject rows first, assign rooms in the grid or Excel, then finalize.
          </p>
          <Button
            size="sm"
            className="mt-2"
            variant="outline"
            disabled={!planId || finalizeRoomsMut.isPending}
            onClick={() => finalizeRoomsMut.mutate()}
          >
            Mark All Assigned Rooms Final
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/70 p-2 py-2">
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-muted-foreground">{label}</p>
    </div>
  );
}
