'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { WorkingCalendarEditor } from '@/components/website-cms/working-calendar/working-calendar-editor';
import {
  createAcademicPlannerYear,
  ensureAcademicPlannerAllMonths,
  ensureAcademicPlannerMonth,
  fetchAcademicPlannerYear,
  fetchAcademicPlannerYears,
  revalidateWebsite,
  saveAcademicPlannerMonth,
  trashAcademicPlannerYear,
  updateAcademicPlannerYear,
} from '@/services/website-cms';
import type { AcademicPlannerDay } from '@/types/website-cms';
import { apiErrorMessage } from '@/utils/api-error';

type Props = { onMessage: (message: string) => void };

function monthOptionsFromRange(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const options: Array<{ key: string; label: string; year: number; month: number }> = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  while (cursor <= last) {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth() + 1;
    const key = `${year}-${String(month).padStart(2, '0')}`;
    const label = cursor.toLocaleString('en-GB', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
    options.push({ key, label, year, month });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return options;
}

export function AcademicYearPlannerView({ onMessage }: Props) {
  const queryClient = useQueryClient();
  const years = useQuery({
    queryKey: ['website', 'academic-planner', 'years'],
    queryFn: fetchAcademicPlannerYears,
  });
  const [yearId, setYearId] = useState<string>('');
  const [monthKey, setMonthKey] = useState('');
  const [title, setTitle] = useState('Academic Year 2026-27');
  const [startDate, setStartDate] = useState('2026-07-01');
  const [endDate, setEndDate] = useState('2027-06-30');
  const [draftDays, setDraftDays] = useState<AcademicPlannerDay[]>([]);

  useEffect(() => {
    if (!yearId && years.data?.length) {
      setYearId(years.data[0].id);
    }
  }, [years.data, yearId]);

  const detail = useQuery({
    queryKey: ['website', 'academic-planner', 'year', yearId, monthKey],
    queryFn: () => fetchAcademicPlannerYear(yearId, monthKey || undefined),
    enabled: Boolean(yearId),
  });

  const selectedYear = years.data?.find((row) => row.id === yearId);
  const monthChoices = useMemo(
    () => (selectedYear ? monthOptionsFromRange(selectedYear.startDate, selectedYear.endDate) : []),
    [selectedYear],
  );

  useEffect(() => {
    if (!monthKey && monthChoices.length) {
      setMonthKey(monthChoices[0].key);
    }
  }, [monthChoices, monthKey]);

  useEffect(() => {
    if (detail.data?.selectedMonth?.days) {
      setDraftDays(detail.data.selectedMonth.days);
    } else if (detail.data && !detail.data.selectedMonth) {
      setDraftDays([]);
    }
  }, [detail.data]);

  const createYear = useMutation({
    mutationFn: () =>
      createAcademicPlannerYear({
        title: title.trim(),
        startDate,
        endDate,
        status: 'DRAFT',
      }),
    onSuccess: (row) => {
      onMessage('Academic year planner created.');
      setYearId(row.id);
      void queryClient.invalidateQueries({ queryKey: ['website', 'academic-planner'] });
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not create planner year')),
  });

  const publish = useMutation({
    mutationFn: (status: 'DRAFT' | 'PUBLISHED') => updateAcademicPlannerYear(yearId, { status }),
    onSuccess: async (row) => {
      onMessage(
        row.status === 'PUBLISHED'
          ? 'Year planner published to the public Academic Calendar page.'
          : 'Year planner set back to draft.',
      );
      void queryClient.invalidateQueries({ queryKey: ['website', 'academic-planner'] });
      await revalidateWebsite(['/academics/calendar']).catch(() => undefined);
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not update planner status')),
  });

  const ensureMonth = useMutation({
    mutationFn: () => {
      const choice = monthChoices.find((item) => item.key === monthKey);
      if (!choice) throw new Error('Select a month first');
      return ensureAcademicPlannerMonth(yearId, {
        year: choice.year,
        month: choice.month,
      });
    },
    onSuccess: (row) => {
      onMessage(`${row.selectedMonth?.title ?? 'Month'} rows ready for editing.`);
      setDraftDays(row.selectedMonth?.days ?? []);
      void queryClient.invalidateQueries({
        queryKey: ['website', 'academic-planner', 'year', yearId],
      });
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not generate month days')),
  });

  const ensureAllMonths = useMutation({
    mutationFn: () => ensureAcademicPlannerAllMonths(yearId),
    onSuccess: (row) => {
      onMessage(
        `All months generated (${row.months.length} month${row.months.length === 1 ? '' : 's'}, ${row.dayCount} days).`,
      );
      setDraftDays(row.selectedMonth?.days ?? []);
      void queryClient.invalidateQueries({
        queryKey: ['website', 'academic-planner', 'year', yearId],
      });
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not generate all months')),
  });

  const saveMonth = useMutation({
    mutationFn: () =>
      saveAcademicPlannerMonth(
        yearId,
        monthKey,
        draftDays.map((day) => ({
          id: day.id,
          date: day.date,
          statusLabel: day.statusLabel,
          description: day.description,
          isWorkingDay: day.isWorkingDay,
          isHighlighted: day.isHighlighted,
        })),
      ),
    onSuccess: async (row) => {
      onMessage(`${row.selectedMonth?.title ?? 'Month'} saved.`);
      setDraftDays(row.selectedMonth?.days ?? []);
      void queryClient.invalidateQueries({
        queryKey: ['website', 'academic-planner', 'year', yearId],
      });
      await revalidateWebsite(['/academics/calendar']).catch(() => undefined);
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not save month')),
  });

  const removeYear = useMutation({
    mutationFn: () => trashAcademicPlannerYear(yearId),
    onSuccess: () => {
      onMessage('Planner year moved to trash.');
      setYearId('');
      setMonthKey('');
      void queryClient.invalidateQueries({ queryKey: ['website', 'academic-planner'] });
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not trash planner year')),
  });

  const monthTitle =
    detail.data?.selectedMonth?.title ??
    monthChoices.find((item) => item.key === monthKey)?.label ??
    'Month';

  const patchDay = (index: number, patch: Partial<AcademicPlannerDay>) => {
    setDraftDays((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  if (years.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading year planner…</p>;
  }

  return (
    <div className="space-y-4">
      <CompactCard>
        <CompactCardHeader
          title="Handbook Year Planner"
          description="Modern working-days calendar for the public /academics/calendar page. Edit day status and events, then publish."
        />
        <CompactCardBody className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Academic Year 2026-27"
          />
          <Input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
          <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          <Button
            disabled={!title.trim() || !startDate || !endDate || createYear.isPending}
            onClick={() => createYear.mutate()}
          >
            Create year
          </Button>
        </CompactCardBody>
      </CompactCard>

      <CompactCard>
        <CompactCardHeader title="Select year" />
        <CompactCardBody className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={yearId}
            onChange={(event) => {
              setYearId(event.target.value);
              setMonthKey('');
            }}
          >
            <option value="">Select planner year</option>
            {(years.data ?? []).map((row) => (
              <option key={row.id} value={row.id}>
                {row.title} · {row.status}
              </option>
            ))}
          </select>
          {selectedYear ? <Badge variant="outline">{selectedYear.status}</Badge> : null}
          <Button
            size="sm"
            variant="outline"
            disabled={!yearId || !monthKey || ensureMonth.isPending || ensureAllMonths.isPending}
            onClick={() => ensureMonth.mutate()}
          >
            Generate month
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!yearId || ensureAllMonths.isPending || ensureMonth.isPending}
            onClick={() => ensureAllMonths.mutate()}
          >
            Generate all months
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!yearId || publish.isPending}
            onClick={() =>
              publish.mutate(selectedYear?.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED')
            }
          >
            {selectedYear?.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!yearId || removeYear.isPending}
            onClick={() => removeYear.mutate()}
          >
            Trash year
          </Button>
        </CompactCardBody>
      </CompactCard>

      {yearId && monthKey ? (
        <WorkingCalendarEditor
          monthChoices={monthChoices}
          monthKey={monthKey}
          monthTitle={monthTitle}
          draftDays={draftDays}
          saving={saveMonth.isPending}
          onSelectMonth={setMonthKey}
          onPatchDay={patchDay}
          onSave={() => saveMonth.mutate()}
        />
      ) : null}
    </div>
  );
}
