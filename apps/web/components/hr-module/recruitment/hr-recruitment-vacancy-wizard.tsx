'use client';

import { useState } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { createRecruitmentVacancy, updateRecruitmentVacancyStatus } from '@/services/hr';
import { fetchDepartments } from '@/services/organization';
import { fetchDesignations } from '@/services/staff';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import { Check } from 'lucide-react';

const STEPS = ['Position Details', 'Eligibility', 'Salary', 'Publication'] as const;

type WizardForm = {
  title: string;
  departmentId: string;
  designationId: string;
  staffType: string;
  vacanciesCount: number;
  description: string;
  qualificationRequired: string;
  experienceRequired: string;
  netSetRequired: boolean;
  phdPreferred: boolean;
  salaryMin: string;
  salaryMax: string;
  closingDate: string;
  publishPortal: boolean;
  publishWebsite: boolean;
  publishWhatsapp: boolean;
  publishEmail: boolean;
};

const INITIAL: WizardForm = {
  title: '',
  departmentId: '',
  designationId: '',
  staffType: 'TEACHING',
  vacanciesCount: 1,
  description: '',
  qualificationRequired: '',
  experienceRequired: '',
  netSetRequired: false,
  phdPreferred: false,
  salaryMin: '',
  salaryMax: '',
  closingDate: '',
  publishPortal: true,
  publishWebsite: false,
  publishWhatsapp: false,
  publishEmail: false,
};

export function HrRecruitmentVacancyWizard({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}) {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<WizardForm>(INITIAL);
  const [error, setError] = useState('');

  const deptQ = useQuery({ queryKey: ['departments'], queryFn: () => fetchDepartments(), enabled });
  const desigQ = useQuery({
    queryKey: ['designations'],
    queryFn: () => fetchDesignations(),
    enabled,
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const vacancy = await createRecruitmentVacancy({
        title: form.title.trim(),
        staffType: form.staffType,
        vacanciesCount: form.vacanciesCount,
        description: form.description || undefined,
        departmentId: form.departmentId || undefined,
        designationId: form.designationId || undefined,
        qualificationRequired: form.qualificationRequired || undefined,
        experienceRequired: form.experienceRequired || undefined,
        salaryMin: form.salaryMin ? Number(form.salaryMin) : undefined,
        salaryMax: form.salaryMax ? Number(form.salaryMax) : undefined,
        closingDate: form.closingDate || undefined,
        eligibilityJson: {
          netSetRequired: form.netSetRequired,
          phdPreferred: form.phdPreferred,
        },
      });
      if (form.publishPortal && vacancy?.id) {
        await updateRecruitmentVacancyStatus(vacancy.id, 'PUBLISHED');
      }
      return vacancy;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['hr', 'recruitment'] });
      setForm(INITIAL);
      setStep(0);
      setError('');
      onOpenChange(false);
      onCreated?.();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Could not create vacancy')),
  });

  const canNext = step === 0 ? form.title.trim().length > 0 : true;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Vacancy</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Professional vacancy setup — publish to the careers portal when ready.
          </p>
        </DialogHeader>

        <div className="mb-6 flex gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold',
                  i < step
                    ? 'bg-primary text-primary-foreground'
                    : i === step
                      ? 'border-2 border-primary bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground',
                )}
              >
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span className="hidden text-center text-[10px] font-medium sm:block">{label}</span>
            </div>
          ))}
        </div>

        {error ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {step === 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Job Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Assistant Professor — Economics"
              />
            </div>
            <div>
              <Label>Department</Label>
              <select
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={form.departmentId}
                onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
              >
                <option value="">Select department</option>
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
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={form.designationId}
                onChange={(e) => setForm({ ...form, designationId: e.target.value })}
              >
                <option value="">Select designation</option>
                {(desigQ.data ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Employment Type</Label>
              <select
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={form.staffType}
                onChange={(e) => setForm({ ...form, staffType: e.target.value })}
              >
                <option value="TEACHING">Teaching</option>
                <option value="NON_TEACHING">Non-Teaching</option>
                <option value="GUEST">Guest Faculty</option>
                <option value="CONTRACT">Contractual</option>
              </select>
            </div>
            <div>
              <Label>Number of Vacancies</Label>
              <Input
                type="number"
                min={1}
                value={form.vacanciesCount}
                onChange={(e) => setForm({ ...form, vacanciesCount: Number(e.target.value) })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Short Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Brief role summary for internal reference"
              />
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-4">
            <div>
              <Label>Qualification Required</Label>
              <Input
                value={form.qualificationRequired}
                onChange={(e) => setForm({ ...form, qualificationRequired: e.target.value })}
                placeholder="M.A. / M.Sc. with NET/SET"
              />
            </div>
            <div>
              <Label>Experience Required</Label>
              <Input
                value={form.experienceRequired}
                onChange={(e) => setForm({ ...form, experienceRequired: e.target.value })}
                placeholder="Minimum 3 years teaching experience"
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border p-4">
              <div>
                <p className="font-medium">NET / SET Required</p>
                <p className="text-xs text-muted-foreground">Mandatory for teaching posts</p>
              </div>
              <Switch
                checked={form.netSetRequired}
                onCheckedChange={(v) => setForm({ ...form, netSetRequired: v })}
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border p-4">
              <div>
                <p className="font-medium">PhD Preferred</p>
                <p className="text-xs text-muted-foreground">Highlight in public listing</p>
              </div>
              <Switch
                checked={form.phdPreferred}
                onCheckedChange={(v) => setForm({ ...form, phdPreferred: v })}
              />
            </div>
            <div>
              <Label>Application Deadline</Label>
              <Input
                type="date"
                value={form.closingDate}
                onChange={(e) => setForm({ ...form, closingDate: e.target.value })}
              />
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Salary Min (₹)</Label>
              <Input
                type="number"
                value={form.salaryMin}
                onChange={(e) => setForm({ ...form, salaryMin: e.target.value })}
                placeholder="Pay scale minimum"
              />
            </div>
            <div>
              <Label>Salary Max (₹)</Label>
              <Input
                type="number"
                value={form.salaryMax}
                onChange={(e) => setForm({ ...form, salaryMax: e.target.value })}
                placeholder="Pay scale maximum"
              />
            </div>
            <p className="sm:col-span-2 text-xs text-muted-foreground">
              Leave blank if salary is as per UGC / college norms. Consolidated amounts can be noted
              in the job description.
            </p>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-3">
            {(
              [
                ['publishPortal', 'Publish on Career Portal', 'career.donboscocollege.ac.in'],
                ['publishWebsite', 'Publish on College Website', 'Main college site listing'],
                ['publishWhatsapp', 'WhatsApp Announcement', 'Notify subscribers (coming soon)'],
                ['publishEmail', 'Email Announcement', 'Faculty mailing list (coming soon)'],
              ] as const
            ).map(([key, title, sub]) => (
              <div key={key} className="flex items-center justify-between rounded-xl border p-4">
                <div>
                  <p className="font-medium">{title}</p>
                  <p className="text-xs text-muted-foreground">{sub}</p>
                </div>
                <Switch
                  checked={form[key]}
                  onCheckedChange={(v) => setForm({ ...form, [key]: v })}
                  disabled={key === 'publishWhatsapp' || key === 'publishEmail'}
                />
              </div>
            ))}
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            disabled={step === 0}
            onClick={() => setStep((s) => s - 1)}
          >
            Back
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {step < STEPS.length - 1 ? (
              <Button type="button" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
                Continue
              </Button>
            ) : (
              <Button
                type="button"
                disabled={!form.title || createMut.isPending}
                onClick={() => createMut.mutate()}
              >
                {createMut.isPending ? 'Creating…' : 'Create Vacancy'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
