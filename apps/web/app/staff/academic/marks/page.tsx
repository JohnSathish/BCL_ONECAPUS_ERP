'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { useRequireStaffPortal } from '@/hooks/use-require-staff-portal';
import {
  fetchExamMarkRoster,
  fetchExamPapers,
  fetchExamSessions,
  saveExamMarks,
  type ExamMarkPayload,
} from '@/services/examinations';

export default function StaffMarksEntryPage() {
  useRequireStaffPortal();
  const qc = useQueryClient();
  const [sessionId, setSessionId] = useState('');
  const [paperId, setPaperId] = useState('');
  const [entries, setEntries] = useState<Record<string, ExamMarkPayload>>({});
  const sessions = useQuery({
    queryKey: ['exams', 'sessions', 'staff-marks'],
    queryFn: () => fetchExamSessions(),
  });
  const activeSession = sessionId || sessions.data?.[0]?.id || '';
  const papers = useQuery({
    queryKey: ['exams', 'papers', activeSession, 'staff-marks'],
    queryFn: () => fetchExamPapers({ sessionId: activeSession || undefined }),
    enabled: Boolean(activeSession),
  });
  const roster = useQuery({
    queryKey: ['exams', 'marks-roster', paperId, 'staff'],
    queryFn: () => fetchExamMarkRoster(paperId),
    enabled: Boolean(paperId),
  });
  const save = useMutation({
    mutationFn: () => saveExamMarks(paperId, Object.values(entries)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exams'] });
      window.alert('Marks saved successfully.');
    },
    onError: (error: any) =>
      window.alert(error?.response?.data?.message ?? error?.message ?? 'Could not save marks'),
  });

  useEffect(() => {
    const next: Record<string, ExamMarkPayload> = {};
    for (const row of roster.data?.rows ?? []) {
      next[row.student.id] = {
        studentId: row.student.id,
        internalMarks: numberOrUndefined(row.mark?.internalMarks),
        externalMarks: numberOrUndefined(row.mark?.externalMarks),
        practicalMarks: numberOrUndefined(row.mark?.practicalMarks),
        graceMarks: numberOrUndefined(row.mark?.graceMarks),
        maxMarks: numberOrUndefined(row.mark?.maxMarks) ?? 100,
        resultStatus: row.mark?.resultStatus,
        entryStatus: row.mark?.entryStatus ?? 'DRAFT',
      };
    }
    setEntries(next);
  }, [roster.data]);

  const update = (studentId: string, patch: Partial<ExamMarkPayload>) => {
    setEntries((prev) => ({
      ...prev,
      [studentId]: { ...(prev[studentId] ?? { studentId, maxMarks: 100 }), ...patch },
    }));
  };

  return (
    <DashboardShell role="staff" title="Marks Entry">
      <div className="space-y-5">
        <section className="rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-background p-5 shadow-xl shadow-primary/5">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Academic Workspace
          </p>
          <h1 className="mt-1 text-2xl font-bold">Marks Entry</h1>
          <p className="text-sm text-muted-foreground">
            Enter internal, external, practical, and grace marks for assigned exam papers.
          </p>
        </section>

        <section className="rounded-3xl border border-border/60 bg-card p-4">
          <div className="flex flex-wrap gap-2">
            <select
              value={activeSession}
              onChange={(event) => {
                setSessionId(event.target.value);
                setPaperId('');
              }}
              className="h-10 min-w-64 rounded-xl border border-border bg-background px-3 text-sm"
            >
              {(sessions.data ?? []).map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name}
                </option>
              ))}
            </select>
            <select
              value={paperId}
              onChange={(event) => setPaperId(event.target.value)}
              className="h-10 min-w-80 rounded-xl border border-border bg-background px-3 text-sm"
            >
              <option value="">Select paper</option>
              {(papers.data ?? []).map((paper) => (
                <option key={paper.id} value={paper.id}>
                  {paper.paperCode} - {paper.paperName}
                </option>
              ))}
            </select>
            <Button
              disabled={!paperId || save.isPending || !Object.keys(entries).length}
              onClick={() => save.mutate()}
            >
              {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Marks
            </Button>
          </div>

          <div className="mt-4 overflow-auto rounded-2xl border border-border/60">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Student</th>
                  <th className="px-3 py-2">Internal</th>
                  <th className="px-3 py-2">External</th>
                  <th className="px-3 py-2">Practical</th>
                  <th className="px-3 py-2">Grace</th>
                  <th className="px-3 py-2">Max</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {(roster.data?.rows ?? []).map((row: any) => {
                  const entry = entries[row.student.id] ?? { studentId: row.student.id };
                  return (
                    <tr key={row.student.id} className="border-t border-border/60">
                      <td className="px-3 py-2">
                        <p className="font-medium">
                          {row.student.masterProfile?.fullName ??
                            row.student.user?.displayName ??
                            'Student'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {row.student.rollNumber ?? row.student.admissionNumber}
                        </p>
                      </td>
                      {(
                        [
                          'internalMarks',
                          'externalMarks',
                          'practicalMarks',
                          'graceMarks',
                          'maxMarks',
                        ] as const
                      ).map((field) => (
                        <td key={field} className="px-3 py-2">
                          <input
                            type="number"
                            value={entry[field] ?? ''}
                            onChange={(event) =>
                              update(row.student.id, {
                                [field]: Number(event.target.value) || undefined,
                              })
                            }
                            className="h-9 w-24 rounded-lg border border-border bg-background px-2 text-sm"
                          />
                        </td>
                      ))}
                      <td className="px-3 py-2">
                        <select
                          value={entry.resultStatus ?? ''}
                          onChange={(event) =>
                            update(row.student.id, {
                              resultStatus: event.target.value || undefined,
                            })
                          }
                          className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
                        >
                          <option value="">Auto</option>
                          <option value="PASS">Pass</option>
                          <option value="FAIL">Fail</option>
                          <option value="ABSENT">Absent</option>
                          <option value="MALPRACTICE">Malpractice</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {paperId && !roster.data?.rows?.length ? (
              <p className="p-4 text-sm text-muted-foreground">No students found for this paper.</p>
            ) : null}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}

function numberOrUndefined(value: unknown) {
  if (value == null || value === '') return undefined;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}
