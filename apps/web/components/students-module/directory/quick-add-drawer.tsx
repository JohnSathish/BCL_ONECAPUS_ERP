'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  FormField,
  FormGrid,
  erpInputCompact,
  erpSelectClass,
} from '@/components/erp/form-primitives';
import { PostAdmitRegistrationActions } from '@/components/students-module/directory/post-admit-registration-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { AdmitStudentPayload, StudentProfile } from '@/types/students';

const ADMISSION_TYPES = ['REGULAR', 'LATERAL', 'MIGRATION', 'RE_ADMISSION'] as const;

const schema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  enrollmentNumber: z.string().min(2),
  programVersionId: z.string().uuid(),
  admissionBatchId: z.string().uuid(),
  streamId: z.string().uuid(),
  primaryShiftId: z.string().uuid(),
  admissionType: z.enum(ADMISSION_TYPES).optional(),
  currentSemester: z.string().optional(),
  rfidNumber: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending?: boolean;
  admittedProfile?: StudentProfile | null;
  programOptions: { id: string; label: string }[];
  batchOptions: { id: string; label: string }[];
  streamOptions: { id: string; label: string }[];
  shiftOptions: { id: string; label: string }[];
  onSubmit: (payload: AdmitStudentPayload) => void;
  onAdmitDone?: () => void;
};

export function QuickAddDrawer({
  open,
  onOpenChange,
  pending,
  admittedProfile,
  programOptions,
  batchOptions,
  streamOptions,
  shiftOptions,
  onSubmit,
  onAdmitDone,
}: Props) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: '',
      email: '',
      enrollmentNumber: '',
      programVersionId: '',
      admissionBatchId: '',
      streamId: '',
      primaryShiftId: '',
      admissionType: 'REGULAR',
      currentSemester: undefined,
      rfidNumber: '',
    },
  });

  const handleSubmit = form.handleSubmit((values) => {
    const parsedSemester = values.currentSemester?.trim()
      ? Number.parseInt(values.currentSemester, 10)
      : undefined;
    onSubmit({
      fullName: values.fullName,
      email: values.email,
      enrollmentNumber: values.enrollmentNumber,
      programVersionId: values.programVersionId,
      admissionBatchId: values.admissionBatchId,
      streamId: values.streamId,
      primaryShiftId: values.primaryShiftId,
      admissionType: values.admissionType || undefined,
      currentSemester:
        parsedSemester != null && !Number.isNaN(parsedSemester) && parsedSemester >= 1
          ? parsedSemester
          : undefined,
      rfidNumber: values.rfidNumber?.trim() || undefined,
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{admittedProfile ? 'Student admitted' : 'Quick add student'}</DialogTitle>
          <DialogDescription>
            {admittedProfile
              ? 'Assign compulsory subjects or open the registration workspace.'
              : 'Admit a student with minimal details. Complete the profile later.'}
          </DialogDescription>
        </DialogHeader>
        {admittedProfile ? (
          <PostAdmitRegistrationActions
            profile={admittedProfile}
            onDone={() => {
              onAdmitDone?.();
              onOpenChange(false);
            }}
          />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormGrid>
              <FormField label="Full name" htmlFor="qa-fullName">
                <Input
                  id="qa-fullName"
                  className={erpInputCompact}
                  {...form.register('fullName')}
                />
              </FormField>
              <FormField label="Email" htmlFor="qa-email">
                <Input id="qa-email" className={erpInputCompact} {...form.register('email')} />
              </FormField>
              <FormField label="NEHU Registration Number" htmlFor="qa-enrollment" span={2}>
                <Input
                  id="qa-enrollment"
                  className={erpInputCompact}
                  {...form.register('enrollmentNumber')}
                />
              </FormField>
              <FormField label="Programme" htmlFor="qa-program">
                <select
                  id="qa-program"
                  className={erpSelectClass}
                  {...form.register('programVersionId')}
                >
                  <option value="">Select programme</option>
                  {programOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Admission batch" htmlFor="qa-batch">
                <select
                  id="qa-batch"
                  className={erpSelectClass}
                  {...form.register('admissionBatchId')}
                >
                  <option value="">Select batch</option>
                  {batchOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Stream" htmlFor="qa-stream">
                <select id="qa-stream" className={erpSelectClass} {...form.register('streamId')}>
                  <option value="">Select stream</option>
                  {streamOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Shift" htmlFor="qa-shift">
                <select
                  id="qa-shift"
                  className={erpSelectClass}
                  {...form.register('primaryShiftId')}
                >
                  <option value="">Select shift</option>
                  {shiftOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Admission type" htmlFor="qa-admissionType">
                <select
                  id="qa-admissionType"
                  className={erpSelectClass}
                  {...form.register('admissionType')}
                >
                  {ADMISSION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Current semester" htmlFor="qa-currentSemester">
                <Input
                  id="qa-currentSemester"
                  type="number"
                  min={1}
                  max={8}
                  className={erpInputCompact}
                  placeholder="Batch default"
                  {...form.register('currentSemester')}
                />
              </FormField>
              <FormField label="RFID (optional)" htmlFor="qa-rfid" span={2}>
                <Input id="qa-rfid" className={erpInputCompact} {...form.register('rfidNumber')} />
              </FormField>
            </FormGrid>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? 'Admitting…' : 'Admit student'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
