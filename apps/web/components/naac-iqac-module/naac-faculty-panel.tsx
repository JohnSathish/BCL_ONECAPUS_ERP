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
  createNaacFacultyAchievement,
  createNaacPortalAchievement,
  bulkReviewNaacFacultyAchievements,
  fetchNaacConstants,
  fetchNaacFacultyAchievements,
  fetchNaacPortalAchievements,
  fetchNaacPortalStaffContext,
  reviewNaacFacultyAchievement,
} from '@/services/naac-iqac';
import { fetchStaffDirectory } from '@/services/staff';
import type { NaacFacultyAchievement } from '@/types/naac-iqac';
import { apiErrorMessage } from '@/utils/api-error';

const statusTone: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-rose-100 text-rose-800',
};

const emptyValues = (): AchievementFormValues => ({
  achievementType: 'publication',
  title: '',
  description: '',
  achievementDate: '',
  criterion: 3,
  academicYear: '2025-26',
  metricCode: '',
});

export function NaacFacultyPanel({
  portalMode = false,
  canReview = true,
}: {
  portalMode?: boolean;
  canReview?: boolean;
}) {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [values, setValues] = useState(emptyValues);
  const [file, setFile] = useState<File | null>(null);
  const [staffProfileId, setStaffProfileId] = useState('');
  const [error, setError] = useState('');
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const constantsQ = useQuery({
    queryKey: ['naac-constants'],
    queryFn: fetchNaacConstants,
    enabled,
  });
  const staffCtxQ = useQuery({
    queryKey: ['naac-portal-staff'],
    queryFn: fetchNaacPortalStaffContext,
    enabled: enabled && portalMode,
  });
  const staffQ = useQuery({
    queryKey: ['naac-staff-pick'],
    queryFn: () => fetchStaffDirectory({ limit: 200, staffType: 'TEACHING' }),
    enabled: enabled && !portalMode,
  });
  const listQ = useQuery({
    queryKey: ['naac-faculty', portalMode, statusFilter],
    queryFn: () =>
      portalMode
        ? fetchNaacPortalAchievements({ limit: 50, status: statusFilter || undefined })
        : fetchNaacFacultyAchievements({
            limit: 50,
            status: statusFilter || undefined,
          }),
    enabled,
  });

  const types = (constantsQ.data as { facultyAchievementTypes?: string[] })
    ?.facultyAchievementTypes ?? [
    'publication',
    'book',
    'patent',
    'award',
    'fdp',
    'conference',
    'project',
  ];

  const createMut = useMutation({
    mutationFn: (form: FormData) =>
      portalMode ? createNaacPortalAchievement(form) : createNaacFacultyAchievement(form),
    onSuccess: () => {
      setValues(emptyValues());
      setFile(null);
      setError('');
      void qc.invalidateQueries({ queryKey: ['naac-faculty'] });
      void qc.invalidateQueries({ queryKey: ['naac-dashboard'] });
    },
    onError: (e) => setError(apiErrorMessage(e, 'Request failed')),
  });

  const reviewMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'APPROVED' | 'REJECTED' }) =>
      reviewNaacFacultyAchievement(id, {
        status,
        reviewNotes: reviewNotes[id],
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['naac-faculty'] }),
    onError: (e) => setError(apiErrorMessage(e, 'Request failed')),
  });

  const bulkReviewMut = useMutation({
    mutationFn: (status: 'APPROVED' | 'REJECTED') =>
      bulkReviewNaacFacultyAchievements({
        ids: Object.entries(selected)
          .filter(([, checked]) => checked)
          .map(([id]) => id),
        status,
      }),
    onSuccess: () => {
      setSelected({});
      void qc.invalidateQueries({ queryKey: ['naac-faculty'] });
    },
    onError: (e) => setError(apiErrorMessage(e, 'Bulk review failed')),
  });

  const staff = staffCtxQ.data?.staff;
  const items = listQ.data?.items ?? [];

  function handleSubmit() {
    if (!file || !values.title.trim()) {
      setError('Title and evidence file are required.');
      return;
    }
    const extra: Record<string, string> = {};
    if (!portalMode && staffProfileId) extra.staffProfileId = staffProfileId;
    createMut.mutate(buildAchievementFormData(file, values, extra));
  }

  return (
    <div className="space-y-4">
      {portalMode && staff ? (
        <p className="rounded border border-blue-200 bg-blue-50 p-3 text-sm dark:bg-blue-950/30">
          Submitting as <strong>{staff.fullName}</strong> ({staff.employeeCode})
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Submit faculty achievement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!portalMode ? (
            <div>
              <Label>Staff member *</Label>
              <select
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={staffProfileId}
                onChange={(e) => setStaffProfileId(e.target.value)}
              >
                <option value="">— Select staff —</option>
                {(staffQ.data?.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.employeeCode} — {s.fullName}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <AchievementMetadataFields
            values={values}
            onChange={setValues}
            achievementTypes={types}
            idPrefix="faculty"
          />

          <div>
            <Label htmlFor="faculty-file">Evidence file *</Label>
            <Input
              id="faculty-file"
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button
            disabled={createMut.isPending || (!portalMode && !staffProfileId)}
            onClick={handleSubmit}
          >
            {createMut.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Submit for IQAC review
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <select
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
        {canReview && !portalMode ? (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={bulkReviewMut.isPending || !Object.values(selected).some(Boolean)}
              onClick={() => bulkReviewMut.mutate('APPROVED')}
            >
              Bulk Approve
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={bulkReviewMut.isPending || !Object.values(selected).some(Boolean)}
              onClick={() => bulkReviewMut.mutate('REJECTED')}
            >
              Bulk Reject
            </Button>
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {canReview && !portalMode ? <th className="px-3 py-2 text-left">Pick</th> : null}
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Title</th>
              <th className="px-3 py-2 text-left">Status</th>
              {canReview && !portalMode ? <th className="px-3 py-2 text-left">Review</th> : null}
              <th className="px-3 py-2 text-left">NAAC</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={canReview && !portalMode ? 5 : 4}
                  className="px-3 py-4 text-muted-foreground"
                >
                  No achievements yet.
                </td>
              </tr>
            ) : (
              items.map((a: NaacFacultyAchievement) => (
                <tr key={a.id} className="border-t align-top">
                  {canReview && !portalMode ? (
                    <td className="px-3 py-2">
                      {a.status === 'PENDING' ? (
                        <input
                          type="checkbox"
                          checked={Boolean(selected[a.id])}
                          onChange={(e) =>
                            setSelected((prev) => ({ ...prev, [a.id]: e.target.checked }))
                          }
                        />
                      ) : null}
                    </td>
                  ) : null}
                  <td className="px-3 py-2">{a.achievementType}</td>
                  <td className="px-3 py-2">{a.title}</td>
                  <td className="px-3 py-2">
                    <Badge className={statusTone[a.status] ?? ''}>{a.status}</Badge>
                  </td>
                  {canReview && !portalMode ? (
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
                      sourceType="faculty_achievement"
                      sourceId={a.id}
                      label="Tag"
                      defaultCriterion={3}
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
