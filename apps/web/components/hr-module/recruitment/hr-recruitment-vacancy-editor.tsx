'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  fetchRecruitmentVacancy,
  updateRecruitmentVacancy,
  type RecruitmentVacancy,
} from '@/services/hr';
import { fetchDepartments } from '@/services/organization';
import { fetchDesignations } from '@/services/staff';
import { apiErrorMessage } from '@/utils/api-error';

export function HrRecruitmentVacancyEditor({
  vacancyId,
  open,
  onOpenChange,
}: {
  vacancyId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [message, setMessage] = useState('');
  const [selectionCommittee, setSelectionCommittee] = useState('');
  const [form, setForm] = useState<Partial<RecruitmentVacancy>>({});

  const vacancyQ = useQuery({
    queryKey: ['hr', 'recruitment', 'vacancy', vacancyId],
    queryFn: () => fetchRecruitmentVacancy(vacancyId!),
    enabled: enabled && open && Boolean(vacancyId),
  });
  const deptQ = useQuery({
    queryKey: ['departments'],
    queryFn: () => fetchDepartments(),
    enabled,
  });
  const desigQ = useQuery({
    queryKey: ['designations'],
    queryFn: () => fetchDesignations(),
    enabled,
  });

  useEffect(() => {
    if (vacancyQ.data) {
      const v = vacancyQ.data;
      setForm({
        title: v.title,
        slug: v.slug ?? '',
        staffType: v.staffType ?? 'TEACHING',
        vacanciesCount: v.vacanciesCount,
        description: v.description ?? '',
        jobDescriptionHtml: v.jobDescriptionHtml ?? '',
        qualificationRequired: v.qualificationRequired ?? '',
        experienceRequired: v.experienceRequired ?? '',
        salaryMin: v.salaryMin != null ? Number(v.salaryMin) : undefined,
        salaryMax: v.salaryMax != null ? Number(v.salaryMax) : undefined,
        closingDate: v.closingDate?.slice(0, 10) ?? '',
        advertisementPdfUrl: v.advertisementPdfUrl ?? '',
        termsPdfUrl: v.termsPdfUrl ?? '',
        departmentId: v.departmentId ?? v.department?.id ?? '',
        designationId: v.designationId ?? v.designation?.id ?? '',
      });
      const eligibility = v.eligibilityJson as {
        selectionCommittee?: { members?: string[] };
      } | null;
      setSelectionCommittee(eligibility?.selectionCommittee?.members?.join(', ') ?? '');
    }
  }, [vacancyQ.data]);

  const saveMut = useMutation({
    mutationFn: () =>
      updateRecruitmentVacancy(vacancyId!, {
        title: form.title,
        slug: form.slug || undefined,
        staffType: form.staffType,
        vacanciesCount: form.vacanciesCount,
        description: form.description,
        jobDescriptionHtml: form.jobDescriptionHtml,
        qualificationRequired: form.qualificationRequired,
        experienceRequired: form.experienceRequired,
        salaryMin: form.salaryMin != null ? Number(form.salaryMin) : undefined,
        salaryMax: form.salaryMax != null ? Number(form.salaryMax) : undefined,
        closingDate: form.closingDate || undefined,
        advertisementPdfUrl: form.advertisementPdfUrl || undefined,
        termsPdfUrl: form.termsPdfUrl || undefined,
        departmentId: form.departmentId || undefined,
        designationId: form.designationId || undefined,
        selectionCommitteeJson: selectionCommittee.trim()
          ? {
              members: selectionCommittee
                .split(',')
                .map((m) => m.trim())
                .filter(Boolean),
            }
          : { members: [] },
      }),
    onSuccess: () => {
      setMessage('Vacancy saved.');
      void qc.invalidateQueries({ queryKey: ['hr', 'recruitment'] });
      onOpenChange(false);
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Could not save vacancy')),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Vacancy</DialogTitle>
        </DialogHeader>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Title</Label>
            <Input
              value={form.title ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div>
            <Label>URL slug</Label>
            <Input
              value={String(form.slug ?? '')}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              placeholder="assistant-professor-economics"
            />
          </div>
          <div>
            <Label>Positions</Label>
            <Input
              type="number"
              value={form.vacanciesCount ?? 1}
              onChange={(e) => setForm((f) => ({ ...f, vacanciesCount: Number(e.target.value) }))}
            />
          </div>
          <div>
            <Label>Department</Label>
            <select
              className="w-full rounded-md border px-2 py-2 text-sm"
              value={form.departmentId ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))}
            >
              <option value="">—</option>
              {(deptQ.data ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Designation</Label>
            <select
              className="w-full rounded-md border px-2 py-2 text-sm"
              value={form.designationId ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, designationId: e.target.value }))}
            >
              <option value="">—</option>
              {(desigQ.data ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Salary min (₹)</Label>
            <Input
              type="number"
              value={form.salaryMin ?? ''}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  salaryMin: e.target.value ? Number(e.target.value) : undefined,
                }))
              }
            />
          </div>
          <div>
            <Label>Salary max (₹)</Label>
            <Input
              type="number"
              value={form.salaryMax ?? ''}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  salaryMax: e.target.value ? Number(e.target.value) : undefined,
                }))
              }
            />
          </div>
          <div>
            <Label>Closing date</Label>
            <Input
              type="date"
              value={String(form.closingDate ?? '')}
              onChange={(e) => setForm((f) => ({ ...f, closingDate: e.target.value }))}
            />
          </div>
          <div>
            <Label>Staff type</Label>
            <select
              className="w-full rounded-md border px-2 py-2 text-sm"
              value={form.staffType ?? 'TEACHING'}
              onChange={(e) => setForm((f) => ({ ...f, staffType: e.target.value }))}
            >
              <option value="TEACHING">Teaching</option>
              <option value="NON_TEACHING">Non-Teaching</option>
              <option value="CONTRACT">Contract</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label>Qualification required</Label>
            <Input
              value={form.qualificationRequired ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, qualificationRequired: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Experience required</Label>
            <Input
              value={form.experienceRequired ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, experienceRequired: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Short description</Label>
            <Input
              value={form.description ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Job description (HTML allowed)</Label>
            <textarea
              className="min-h-28 w-full rounded-md border px-3 py-2 text-sm"
              value={form.jobDescriptionHtml ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, jobDescriptionHtml: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Selection committee (comma-separated)</Label>
            <Input
              value={selectionCommittee}
              onChange={(e) => setSelectionCommittee(e.target.value)}
              placeholder="Principal, HOD, External Expert"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Used on interview call letters when no per-interview panel is set.
            </p>
          </div>
          <div className="sm:col-span-2">
            <Label>Advertisement PDF URL</Label>
            <Input
              value={form.advertisementPdfUrl ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, advertisementPdfUrl: e.target.value }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!form.title || saveMut.isPending} onClick={() => saveMut.mutate()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
