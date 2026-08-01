'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type {
  AcademicCalendarEvent,
  AcademicCalendarEventTypeRow,
} from '@/services/academic-calendar';
import { buildSimpleRrule, colorForType } from '@/lib/academic-calendar-ui';

const schema = z.object({
  title: z.string().min(1, 'Title is required').max(300),
  type: z.string().min(1),
  description: z.string().optional(),
  venue: z.string().optional(),
  startDate: z.string().min(1),
  endDate: z.string().optional(),
  isAllDay: z.boolean(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  visibilityStudents: z.boolean(),
  visibilityStaff: z.boolean(),
  visibilityParents: z.boolean(),
  visibilityPublic: z.boolean(),
  publishedToWebsite: z.boolean(),
  isRecurring: z.boolean(),
  recurrenceFreq: z.enum(['NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']),
  organizerName: z.string().optional(),
});

export type EventFormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventTypes: AcademicCalendarEventTypeRow[];
  initialDate?: string;
  editing?: AcademicCalendarEvent | null;
  saving?: boolean;
  onSubmit: (values: EventFormValues, addAnother: boolean) => Promise<void>;
};

export function AcademicCalendarEventFormDialog({
  open,
  onOpenChange,
  eventTypes,
  initialDate,
  editing,
  saving,
  onSubmit,
}: Props) {
  const [addAnother, setAddAnother] = useState(false);
  const form = useForm<EventFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      type: 'INSTITUTIONAL_EVENT',
      description: '',
      venue: '',
      startDate: initialDate ?? '',
      endDate: initialDate ?? '',
      isAllDay: true,
      startTime: '09:00',
      endTime: '10:00',
      color: '',
      icon: '',
      visibilityStudents: true,
      visibilityStaff: true,
      visibilityParents: false,
      visibilityPublic: false,
      publishedToWebsite: false,
      isRecurring: false,
      recurrenceFreq: 'NONE',
      organizerName: '',
    },
  });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      const flags = editing.visibilityFlags ?? {};
      form.reset({
        title: editing.title,
        type: editing.type,
        description: editing.description ?? '',
        venue: editing.venue ?? '',
        startDate: editing.startDate,
        endDate: editing.endDate,
        isAllDay: editing.isAllDay ?? true,
        startTime: editing.startTime ?? '09:00',
        endTime: editing.endTime ?? '10:00',
        color: editing.color ?? '',
        icon: editing.icon ?? '',
        visibilityStudents: flags.students ?? true,
        visibilityStaff: flags.staff ?? true,
        visibilityParents: flags.parents ?? false,
        visibilityPublic: flags.public ?? editing.visibility === 'PUBLIC',
        publishedToWebsite: editing.publishedToWebsite,
        isRecurring: Boolean(editing.isRecurring),
        recurrenceFreq: editing.recurrenceRule?.includes('YEARLY')
          ? 'YEARLY'
          : editing.recurrenceRule?.includes('MONTHLY')
            ? 'MONTHLY'
            : editing.recurrenceRule?.includes('WEEKLY')
              ? 'WEEKLY'
              : editing.recurrenceRule?.includes('DAILY')
                ? 'DAILY'
                : 'NONE',
        organizerName: editing.organizerName ?? '',
      });
    } else {
      form.reset({
        title: '',
        type: 'INSTITUTIONAL_EVENT',
        description: '',
        venue: '',
        startDate: initialDate ?? '',
        endDate: initialDate ?? '',
        isAllDay: true,
        startTime: '09:00',
        endTime: '10:00',
        color: colorForType('INSTITUTIONAL_EVENT'),
        icon: '',
        visibilityStudents: true,
        visibilityStaff: true,
        visibilityParents: false,
        visibilityPublic: false,
        publishedToWebsite: false,
        isRecurring: false,
        recurrenceFreq: 'NONE',
        organizerName: '',
      });
    }
  }, [open, editing, initialDate, form]);

  const watchType = form.watch('type');
  const isAllDay = form.watch('isAllDay');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto rounded-2xl border-[#E5E7EB] p-6 shadow-xl">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Event' : 'Add Event'}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(async (values) => {
            await onSubmit(values, addAnother);
            if (addAnother && !editing) {
              form.setValue('title', '');
              form.setValue('description', '');
            }
            setAddAnother(false);
          })}
        >
          <div className="space-y-1">
            <Label>Event Title *</Label>
            <Input {...form.register('title')} />
            {form.formState.errors.title ? (
              <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Event Type *</Label>
              <select
                className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
                {...form.register('type', {
                  onChange: (e) => {
                    form.setValue('color', colorForType(e.target.value));
                  },
                })}
              >
                {eventTypes.map((t) => (
                  <option key={t.type} value={t.type}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Color</Label>
              <Input type="color" {...form.register('color')} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Description</Label>
            <textarea
              className="min-h-[72px] w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
              {...form.register('description')}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Venue / Location</Label>
              <Input {...form.register('venue')} />
            </div>
            <div className="space-y-1">
              <Label>Organizer</Label>
              <Input {...form.register('organizerName')} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Start Date *</Label>
              <Input type="date" {...form.register('startDate')} />
            </div>
            <div className="space-y-1">
              <Label>End Date</Label>
              <Input type="date" {...form.register('endDate')} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...form.register('isAllDay')} />
            All Day Event
          </label>

          {!isAllDay ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Start Time</Label>
                <Input type="time" {...form.register('startTime')} />
              </div>
              <div className="space-y-1">
                <Label>End Time</Label>
                <Input type="time" {...form.register('endTime')} />
              </div>
            </div>
          ) : null}

          <div className="space-y-1">
            <Label>Icon (optional emoji / short text)</Label>
            <Input placeholder="🎓" {...form.register('icon')} />
          </div>

          <div className="space-y-2 rounded-md border border-border p-3">
            <p className="text-sm font-medium">Visibility</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" {...form.register('visibilityStudents')} /> Students
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" {...form.register('visibilityStaff')} /> Staff
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" {...form.register('visibilityParents')} /> Parents
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" {...form.register('visibilityPublic')} /> Public
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...form.register('publishedToWebsite')} /> Publish to website
            </label>
          </div>

          <div className="space-y-2 rounded-md border border-border p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" {...form.register('isRecurring')} /> Recurring event
            </label>
            {form.watch('isRecurring') ? (
              <select
                className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
                {...form.register('recurrenceFreq')}
              >
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="YEARLY">Yearly</option>
              </select>
            ) : null}
          </div>

          <p className="text-xs text-muted-foreground">
            Default color for {watchType}: {colorForType(watchType)}
          </p>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {!editing ? (
              <Button
                type="submit"
                variant="secondary"
                disabled={saving}
                onClick={() => setAddAnother(true)}
              >
                Save & Add Another
              </Button>
            ) : null}
            <Button type="submit" disabled={saving} onClick={() => setAddAnother(false)}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function formValuesToPayload(values: EventFormValues) {
  const recurring =
    values.isRecurring && values.recurrenceFreq !== 'NONE'
      ? buildSimpleRrule(values.recurrenceFreq)
      : null;
  return {
    title: values.title,
    type: values.type,
    description: values.description || undefined,
    venue: values.venue || undefined,
    startDate: values.startDate,
    endDate: values.endDate || values.startDate,
    isAllDay: values.isAllDay,
    startTime: values.isAllDay ? null : values.startTime || null,
    endTime: values.isAllDay ? null : values.endTime || null,
    color: values.color || colorForType(values.type),
    icon: values.icon || undefined,
    visibility: values.visibilityPublic ? 'PUBLIC' : 'INTERNAL',
    publishedToWebsite: values.publishedToWebsite,
    visibilityFlags: {
      students: values.visibilityStudents,
      staff: values.visibilityStaff,
      parents: values.visibilityParents,
      public: values.visibilityPublic,
    },
    isRecurring: Boolean(recurring),
    recurrenceRule: recurring,
    organizerName: values.organizerName || undefined,
  };
}
