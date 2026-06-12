'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';

import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import {
  FormField,
  FormGrid,
  erpInputCompact,
  erpSelectClass,
} from '@/components/erp/form-primitives';
import { Button } from '@/components/ui/button';
import { DateInput } from '@/components/ui/date-input';
import { Input } from '@/components/ui/input';
import { StudentPhotoUpload } from '@/components/student-records/student-photo-upload';
import type { AdmitStudentPayload } from '@/types/students';

const schema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  enrollmentNumber: z.string().min(2),
  rollNumber: z.string().optional(),
  mobileNumber: z.string().optional(),
  programVersionId: z.string().uuid(),
  admissionBatchId: z.string().uuid(),
  streamId: z.string().uuid(),
  primaryShiftId: z.string().uuid(),
  departmentId: z.string().uuid().optional().or(z.literal('')),
  gender: z.string().optional(),
  dateOfBirth: z.string().optional(),
  categoryLookupId: z.string().uuid().optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  disabled?: boolean;
  pending?: boolean;
  programOptions: { id: string; label: string }[];
  batchOptions: { id: string; label: string }[];
  streamOptions: { id: string; label: string }[];
  shiftOptions: { id: string; label: string }[];
  departmentOptions: { id: string; label: string }[];
  categoryOptions: { id: string; label: string }[];
  photoFile?: File | null;
  onPhotoSelect?: (file: File) => void;
  onSubmit: (payload: AdmitStudentPayload) => void;
};

export function StudentAdmissionForm({
  disabled,
  pending,
  programOptions,
  batchOptions,
  streamOptions,
  shiftOptions,
  departmentOptions,
  categoryOptions,
  photoFile,
  onPhotoSelect,
  onSubmit,
}: Props) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: '',
      email: '',
      enrollmentNumber: '',
      rollNumber: '',
      mobileNumber: '',
      programVersionId: '',
      admissionBatchId: '',
      streamId: '',
      primaryShiftId: '',
      departmentId: '',
      gender: '',
      dateOfBirth: '',
      categoryLookupId: '',
    },
  });

  return (
    <CompactCard className="sticky top-4">
      <CompactCardHeader
        title="New admission"
        description="Semester is assigned from batch — not entered manually"
      />
      <CompactCardBody>
        <form
          onSubmit={form.handleSubmit((v) =>
            onSubmit({
              fullName: v.fullName,
              email: v.email,
              enrollmentNumber: v.enrollmentNumber,
              rollNumber: v.rollNumber || undefined,
              mobileNumber: v.mobileNumber || undefined,
              programVersionId: v.programVersionId,
              admissionBatchId: v.admissionBatchId,
              streamId: v.streamId,
              primaryShiftId: v.primaryShiftId,
              departmentId: v.departmentId || undefined,
              gender: v.gender || undefined,
              dateOfBirth: v.dateOfBirth || undefined,
              categoryLookupId: v.categoryLookupId || undefined,
            }),
          )}
        >
          <FormGrid>
            <FormField label="Full name" span={2}>
              <Input
                className={erpInputCompact}
                {...form.register('fullName')}
                disabled={disabled}
              />
            </FormField>
            <FormField label="Email" span={2}>
              <Input
                type="email"
                className={erpInputCompact}
                {...form.register('email')}
                disabled={disabled}
              />
            </FormField>
            <FormField label="NEHU Registration Number">
              <Input
                className={erpInputCompact}
                {...form.register('enrollmentNumber')}
                disabled={disabled}
              />
            </FormField>
            <FormField label="Roll Number">
              <Input
                className={erpInputCompact}
                {...form.register('rollNumber')}
                disabled={disabled}
              />
            </FormField>
            <FormField label="Mobile">
              <Input
                className={erpInputCompact}
                {...form.register('mobileNumber')}
                disabled={disabled}
              />
            </FormField>
            <FormField label="Programme" span={2}>
              <select
                className={erpSelectClass}
                {...form.register('programVersionId')}
                disabled={disabled}
              >
                <option value="">Select programme</option>
                {programOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Admission batch" span={2}>
              <select
                className={erpSelectClass}
                {...form.register('admissionBatchId')}
                disabled={disabled}
              >
                <option value="">Select batch</option>
                {batchOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Stream">
              <select className={erpSelectClass} {...form.register('streamId')} disabled={disabled}>
                <option value="">Select stream</option>
                {streamOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Shift">
              <select
                className={erpSelectClass}
                {...form.register('primaryShiftId')}
                disabled={disabled}
              >
                <option value="">Select shift</option>
                {shiftOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Department">
              <select
                className={erpSelectClass}
                {...form.register('departmentId')}
                disabled={disabled}
              >
                <option value="">Optional</option>
                {departmentOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Category">
              <select
                className={erpSelectClass}
                {...form.register('categoryLookupId')}
                disabled={disabled}
              >
                <option value="">Optional</option>
                {categoryOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Gender">
              <Input className={erpInputCompact} {...form.register('gender')} disabled={disabled} />
            </FormField>
            <FormField label="Date of birth">
              <Controller
                name="dateOfBirth"
                control={form.control}
                render={({ field }) => (
                  <DateInput
                    className={erpInputCompact}
                    disabled={disabled}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                  />
                )}
              />
            </FormField>
            {onPhotoSelect ? (
              <FormField label="Photo" span={2}>
                <StudentPhotoUpload
                  disabled={disabled}
                  onSelect={onPhotoSelect}
                  photoPath={photoFile ? URL.createObjectURL(photoFile) : null}
                />
              </FormField>
            ) : null}
          </FormGrid>
          <Button type="submit" size="sm" className="mt-3 w-full" disabled={disabled || pending}>
            {pending ? 'Admitting…' : 'Admit student'}
          </Button>
        </form>
      </CompactCardBody>
    </CompactCard>
  );
}
