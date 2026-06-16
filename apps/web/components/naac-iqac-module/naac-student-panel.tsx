'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  AchievementMetadataFields,
  buildAchievementFormData,
  type AchievementFormValues,
} from '@/components/naac-iqac-module/achievement-form-fields';
import { NaacEvidenceTagButton } from '@/components/naac-iqac-module/naac-evidence-tag-button';
import {
  createNaacStudentAchievement,
  fetchNaacConstants,
  fetchNaacStudentAchievements,
  reviewNaacStudentAchievement,
} from '@/services/naac-iqac';
import { fetchAcademicDepartments } from '@/services/organization';
import type { NaacStudentAchievement } from '@/types/naac-iqac';
import { apiErrorMessage } from '@/utils/api-error';

const statusTone: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-rose-100 text-rose-800',
};

const emptyValues = (): AchievementFormValues => ({
  achievementType: 'sports',
  title: '',
  description: '',
  achievementDate: '',
  criterion: 5,
  academicYear: '2025-26',
  metricCode: '',
});

export function NaacStudentPanel({ canReview = true }: { canReview?: boolean }) {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [values, setValues] = useState(emptyValues);
  const [file, setFile] = useState<File | null>(null);
  const [studentId, setStudentId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [error, setError] = useState('');
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const constantsQ = useQuery({
    queryKey: ['naac-constants'],
    queryFn: fetchNaacConstants,
    enabled,
  });
  const deptQ = useQuery({
    queryKey: ['naac-depts'],
    queryFn: () => fetchAcademicDepartments(),
    enabled,
  });
  const listQ = useQuery({
    queryKey: ['naac-student'],
    queryFn: () => fetchNaacStudentAchievements({ limit: 50 }),
    enabled,
  });

  const types = (constantsQ.data as { studentAchievementTypes?: string[] })
    ?.studentAchievementTypes ?? [
    'sports',
    'cultural',
    'academic',
    'competition',
    'placement',
    'higher_studies',
  ];

  const createMut = useMutation({
    mutationFn: (form: FormData) => createNaacStudentAchievement(form),
    onSuccess: () => {
      setValues(emptyValues());
      setFile(null);
      setStudentId('');
      setError('');
      void qc.invalidateQueries({ queryKey: ['naac-student'] });
    },
    onError: (e) => setError(apiErrorMessage(e, 'Request failed')),
  });

  const reviewMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'APPROVED' | 'REJECTED' }) =>
      reviewNaacStudentAchievement(id, { status, reviewNotes: reviewNotes[id] }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['naac-student'] }),
    onError: (e) => setError(apiErrorMessage(e, 'Request failed')),
  });

  function handleSubmit() {
    if (!file || !values.title.trim()) {
      setError('Title and evidence file are required.');
      return;
    }
    const extra: Record<string, string> = {};
    if (studentId.trim()) extra.studentId = studentId.trim();
    if (departmentId) extra.departmentId = departmentId;
    createMut.mutate(buildAchievementFormData(file, values, extra));
  }

  const items = listQ.data?.items ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Submit student achievement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Student ID (optional)</Label>
              <Input
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="UUID from student record"
              />
            </div>
            <div>
              <Label>Department</Label>
              <select
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
              >
                <option value="">— Optional —</option>
                {(deptQ.data ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} — {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <AchievementMetadataFields
            values={values}
            onChange={setValues}
            achievementTypes={types}
            idPrefix="student"
          />

          <div>
            <Label htmlFor="student-file">Evidence file *</Label>
            <Input
              id="student-file"
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button disabled={createMut.isPending} onClick={handleSubmit}>
            {createMut.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Submit for IQAC review
          </Button>
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Title</th>
              <th className="px-3 py-2 text-left">Status</th>
              {canReview ? <th className="px-3 py-2 text-left">Review</th> : null}
              <th className="px-3 py-2 text-left">NAAC</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={canReview ? 5 : 4} className="px-3 py-4 text-muted-foreground">
                  No achievements yet.
                </td>
              </tr>
            ) : (
              items.map((a: NaacStudentAchievement) => (
                <tr key={a.id} className="border-t align-top">
                  <td className="px-3 py-2">{a.achievementType}</td>
                  <td className="px-3 py-2">{a.title}</td>
                  <td className="px-3 py-2">
                    <Badge className={statusTone[a.status] ?? ''}>{a.status}</Badge>
                  </td>
                  {canReview ? (
                    <td className="px-3 py-2">
                      {a.status === 'PENDING' ? (
                        <div className="space-y-1">
                          <Input
                            placeholder="Review notes"
                            value={reviewNotes[a.id] ?? ''}
                            onChange={(e) =>
                              setReviewNotes((prev) => ({ ...prev, [a.id]: e.target.value }))
                            }
                          />
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              disabled={reviewMut.isPending}
                              onClick={() => reviewMut.mutate({ id: a.id, status: 'APPROVED' })}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={reviewMut.isPending}
                              onClick={() => reviewMut.mutate({ id: a.id, status: 'REJECTED' })}
                            >
                              Reject
                            </Button>
                          </div>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                  ) : null}
                  <td className="px-3 py-2">
                    <NaacEvidenceTagButton
                      sourceType="student_achievement"
                      sourceId={a.id}
                      label="Tag"
                      defaultCriterion={5}
                      defaultActivityTitle={a.title}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
