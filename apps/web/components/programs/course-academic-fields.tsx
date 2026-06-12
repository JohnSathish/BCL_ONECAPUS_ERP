'use client';

import { useEffect, useRef, useState } from 'react';
import type { FieldErrors, UseFormRegister, UseFormSetValue, UseFormWatch } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import {
  ATTENDANCE_MODES,
  COURSE_DELIVERY_LABELS,
  COURSE_DELIVERY_TYPES,
  getDeliveryProfile,
  MANUAL_CREDIT_HELPER_TEXT,
  type AttendanceMode,
  type CourseDeliveryType,
} from '@/constants/course-delivery';
import { cn } from '@/utils/cn';
import {
  isManualCreditForm,
  resolveCreditCalculationMode,
} from '@/utils/course-academic-structure';

const selectClass = 'h-10 w-full rounded-md border border-border bg-card px-3 text-sm';

export type CourseAcademicFieldsValues = {
  deliveryType: CourseDeliveryType;
  creditCalculationMode?: 'AUTO_CALCULATED' | 'MANUAL_OVERRIDE';
  credits: number;
  theoryCredits: number;
  practicalCredits: number;
  theoryHoursPerWeek: number;
  practicalHoursPerWeek: number;
  totalTheoryContactHours: number;
  totalPracticalContactHours: number;
  totalContactHours: number;
  attendanceMode?: AttendanceMode;
  labRequired?: boolean;
  requiresTimetableSlots?: boolean;
};

type FieldProps = {
  label: string;
  id?: string;
  children: React.ReactNode;
  error?: string;
  hint?: string;
};

function Field({ label, id, children, error, hint }: FieldProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type Props = {
  canManage: boolean;
  register: UseFormRegister<CourseAcademicFieldsValues>;
  watch: UseFormWatch<CourseAcademicFieldsValues>;
  setValue: UseFormSetValue<CourseAcademicFieldsValues>;
  errors: FieldErrors<CourseAcademicFieldsValues>;
};

export function CourseAcademicFields({ canManage, register, watch, setValue, errors }: Props) {
  const deliveryType = watch('deliveryType');
  const creditCalculationMode = watch('creditCalculationMode');
  const theoryCreditsNum = Number(watch('theoryCredits')) || 0;
  const practicalCreditsNum = Number(watch('practicalCredits')) || 0;
  const theoryContactWatch = watch('totalTheoryContactHours');
  const practicalContactWatch = watch('totalPracticalContactHours');

  const isManual = isManualCreditForm(deliveryType, creditCalculationMode);
  const profile = deliveryType ? getDeliveryProfile(deliveryType) : null;

  useEffect(() => {
    if (!deliveryType) return;
    const mode = resolveCreditCalculationMode(deliveryType, creditCalculationMode);
    setValue('creditCalculationMode', mode, { shouldValidate: false });
  }, [deliveryType, creditCalculationMode, setValue]);

  useEffect(() => {
    if (isManual) return;
    const total = theoryCreditsNum + practicalCreditsNum;
    if (total > 0) {
      setValue('credits', total, { shouldValidate: true });
    }
  }, [isManual, theoryCreditsNum, practicalCreditsNum, setValue]);

  useEffect(() => {
    if (isManual) return;
    const theoryContact = Number(theoryContactWatch) || 0;
    const practicalContact = Number(practicalContactWatch) || 0;
    setValue('totalContactHours', theoryContact + practicalContact, {
      shouldValidate: false,
    });
  }, [isManual, theoryContactWatch, practicalContactWatch, setValue]);

  useEffect(() => {
    if (theoryCreditsNum === 0) {
      setValue('theoryHoursPerWeek', 0, { shouldValidate: true });
      setValue('totalTheoryContactHours', 0, { shouldValidate: true });
    }
    if (practicalCreditsNum === 0) {
      setValue('practicalHoursPerWeek', 0, { shouldValidate: true });
      setValue('totalPracticalContactHours', 0, { shouldValidate: true });
    }
  }, [theoryCreditsNum, practicalCreditsNum, setValue]);

  const prevDeliveryTypeRef = useRef(deliveryType);
  useEffect(() => {
    const prev = prevDeliveryTypeRef.current;
    const next = deliveryType;
    prevDeliveryTypeRef.current = next;
    if (!next || prev === next) return;

    if (next === 'THEORY') {
      setValue('practicalCredits', 0, { shouldValidate: true });
      setValue('practicalHoursPerWeek', 0, { shouldValidate: true });
      setValue('totalPracticalContactHours', 0, { shouldValidate: true });
    } else if (next === 'PRACTICAL') {
      setValue('theoryCredits', 0, { shouldValidate: true });
      setValue('theoryHoursPerWeek', 0, { shouldValidate: true });
      setValue('totalTheoryContactHours', 0, { shouldValidate: true });
    } else if (isManualCreditForm(next)) {
      setValue('creditCalculationMode', 'MANUAL_OVERRIDE', { shouldValidate: false });
      setValue('theoryHoursPerWeek', 0, { shouldValidate: true });
      setValue('practicalHoursPerWeek', 0, { shouldValidate: true });
      setValue('totalTheoryContactHours', 0, { shouldValidate: true });
      setValue('totalPracticalContactHours', 0, { shouldValidate: true });
    } else {
      setValue('creditCalculationMode', 'AUTO_CALCULATED', { shouldValidate: false });
    }
  }, [deliveryType, setValue]);

  const showWeeklySection = !isManual || profile?.requiresWeeklyHours;
  const showSplitContact = !isManual || profile?.requiresSplitContactHours;
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    const prev = prevDeliveryTypeRef.current;
    if (!deliveryType || prev === deliveryType) return;
    if (isManual) {
      setValue('attendanceMode', 'MENTOR_APPROVAL', { shouldValidate: false });
      setValue('requiresTimetableSlots', false, { shouldValidate: false });
    } else {
      setValue('attendanceMode', 'REGULAR', { shouldValidate: false });
      setValue('requiresTimetableSlots', true, { shouldValidate: false });
    }
  }, [deliveryType, isManual, setValue]);

  return (
    <>
      <input type="hidden" {...register('creditCalculationMode')} />
      <Field label="Delivery type" error={errors.deliveryType?.message}>
        <select
          className={cn(selectClass, errors.deliveryType && 'border-destructive')}
          {...register('deliveryType')}
          disabled={!canManage}
        >
          {COURSE_DELIVERY_TYPES.map((t) => (
            <option key={t} value={t}>
              {COURSE_DELIVERY_LABELS[t]}
            </option>
          ))}
        </select>
      </Field>

      {isManual ? (
        <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
          {MANUAL_CREDIT_HELPER_TEXT}
        </p>
      ) : null}

      {!isManual ? (
        <>
          <p className="text-xs font-medium text-muted-foreground">Weekly teaching workload</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Theory credits"
              id="course-theory-credits"
              error={errors.theoryCredits?.message}
            >
              <Input
                id="course-theory-credits"
                type="number"
                step="0.5"
                min={0}
                className={cn(errors.theoryCredits && 'border-destructive')}
                {...register('theoryCredits', { valueAsNumber: true })}
                disabled={!canManage}
              />
            </Field>
            <Field
              label="Practical credits"
              id="course-practical-credits"
              error={errors.practicalCredits?.message}
            >
              <Input
                id="course-practical-credits"
                type="number"
                step="0.5"
                min={0}
                className={cn(errors.practicalCredits && 'border-destructive')}
                {...register('practicalCredits', { valueAsNumber: true })}
                disabled={!canManage}
              />
            </Field>
            {showWeeklySection ? (
              <>
                <Field
                  label="Weekly theory hours"
                  id="course-theory-hours"
                  error={errors.theoryHoursPerWeek?.message}
                >
                  <Input
                    id="course-theory-hours"
                    type="number"
                    min={0}
                    className={cn(errors.theoryHoursPerWeek && 'border-destructive')}
                    {...register('theoryHoursPerWeek', { valueAsNumber: true })}
                    disabled={!canManage || theoryCreditsNum === 0}
                  />
                </Field>
                <Field
                  label="Weekly practical hours"
                  id="course-practical-hours"
                  error={errors.practicalHoursPerWeek?.message}
                >
                  <Input
                    id="course-practical-hours"
                    type="number"
                    min={0}
                    className={cn(errors.practicalHoursPerWeek && 'border-destructive')}
                    {...register('practicalHoursPerWeek', { valueAsNumber: true })}
                    disabled={!canManage || practicalCreditsNum === 0}
                  />
                </Field>
              </>
            ) : null}
          </div>
          <Field
            label="Total credits"
            id="course-credits"
            error={errors.credits?.message}
            hint="Computed from theory + practical credits"
          >
            <Input
              id="course-credits"
              type="number"
              step="0.5"
              readOnly
              className={cn('bg-muted', errors.credits && 'border-destructive')}
              {...register('credits', { valueAsNumber: true })}
              disabled={!canManage}
            />
          </Field>
        </>
      ) : (
        <>
          <Field
            label="Total credits"
            id="course-credits"
            error={errors.credits?.message}
            hint="Direct credit allocation (no theory/practical split required)"
          >
            <Input
              id="course-credits"
              type="number"
              step="0.5"
              min={0}
              className={cn(errors.credits && 'border-destructive')}
              {...register('credits', { valueAsNumber: true })}
              disabled={!canManage}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Theory credits"
              id="course-theory-credits-manual"
              error={errors.theoryCredits?.message}
              hint="Optional for experiential components"
            >
              <Input
                id="course-theory-credits-manual"
                type="number"
                step="0.5"
                min={0}
                className={cn(errors.theoryCredits && 'border-destructive')}
                {...register('theoryCredits', { valueAsNumber: true })}
                disabled={!canManage}
              />
            </Field>
            <Field
              label="Practical credits"
              id="course-practical-credits-manual"
              error={errors.practicalCredits?.message}
              hint="Optional for experiential components"
            >
              <Input
                id="course-practical-credits-manual"
                type="number"
                step="0.5"
                min={0}
                className={cn(errors.practicalCredits && 'border-destructive')}
                {...register('practicalCredits', { valueAsNumber: true })}
                disabled={!canManage}
              />
            </Field>
          </div>
        </>
      )}

      <p className="text-xs font-medium text-muted-foreground">University contact hours</p>
      {showSplitContact ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Total theory contact hours"
              id="course-theory-contact"
              error={errors.totalTheoryContactHours?.message}
            >
              <Input
                id="course-theory-contact"
                type="number"
                min={0}
                className={cn(errors.totalTheoryContactHours && 'border-destructive')}
                {...register('totalTheoryContactHours', { valueAsNumber: true })}
                disabled={!canManage || (!isManual && theoryCreditsNum === 0)}
              />
            </Field>
            <Field
              label="Total practical contact hours"
              id="course-practical-contact"
              error={errors.totalPracticalContactHours?.message}
            >
              <Input
                id="course-practical-contact"
                type="number"
                min={0}
                className={cn(errors.totalPracticalContactHours && 'border-destructive')}
                {...register('totalPracticalContactHours', { valueAsNumber: true })}
                disabled={!canManage || (!isManual && practicalCreditsNum === 0)}
              />
            </Field>
          </div>
          <Field
            label="Total contact hours"
            id="course-total-contact"
            hint="Computed from theory + practical contact hours"
          >
            <Input
              id="course-total-contact"
              type="number"
              readOnly
              className="bg-muted"
              {...register('totalContactHours', { valueAsNumber: true })}
              disabled={!canManage}
            />
          </Field>
        </>
      ) : (
        <Field
          label="Total contact hours"
          id="course-total-contact"
          error={errors.totalContactHours?.message}
          hint="Semester-level contact hours (e.g. 120 for internship)"
        >
          <Input
            id="course-total-contact"
            type="number"
            min={0}
            className={cn(errors.totalContactHours && 'border-destructive')}
            {...register('totalContactHours', { valueAsNumber: true })}
            disabled={!canManage}
          />
        </Field>
      )}

      <div className="rounded-lg border border-border">
        <button
          type="button"
          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium"
          onClick={() => setAdvancedOpen((o) => !o)}
        >
          Advanced delivery settings
          <span className="text-muted-foreground">{advancedOpen ? '−' : '+'}</span>
        </button>
        {advancedOpen ? (
          <div className="space-y-4 border-t border-border px-3 py-3">
            <Field label="Attendance mode">
              <select className={selectClass} {...register('attendanceMode')} disabled={!canManage}>
                {ATTENDANCE_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Experiential components typically use mentor approval rather than regular class
                attendance.
              </p>
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="rounded border-border"
                {...register('labRequired')}
                disabled={!canManage}
              />
              Lab required (triggers practical lab fee even without practical credits)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="rounded border-border"
                {...register('requiresTimetableSlots')}
                disabled={!canManage}
              />
              Requires timetable slots
            </label>
          </div>
        ) : null}
      </div>
    </>
  );
}
