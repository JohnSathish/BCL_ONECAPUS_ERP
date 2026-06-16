'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createNaacCalendarEvent,
  fetchNaacCalendar,
  fetchNaacConstants,
} from '@/services/naac-iqac';
import type { NaacCalendarEvent } from '@/types/naac-iqac';
import { apiErrorMessage } from '@/utils/api-error';

export function NaacCalendarPanel() {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState('AQAR_DUE');
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');

  const constantsQ = useQuery({ queryKey: ['naac-constants'], queryFn: fetchNaacConstants });
  const calendarQ = useQuery({ queryKey: ['naac-calendar'], queryFn: fetchNaacCalendar });

  const eventTypes = (constantsQ.data as { calendarEventTypes?: string[] })?.calendarEventTypes ?? [
    'AQAR_DUE',
    'IQAC_MEETING',
    'DEPT_SUBMISSION',
    'ACADEMIC_AUDIT',
    'FEEDBACK',
    'SSR_REVIEW',
  ];

  const createMut = useMutation({
    mutationFn: () =>
      createNaacCalendarEvent({
        title,
        eventType,
        dueDate,
        description: description || undefined,
      }),
    onSuccess: () => {
      setTitle('');
      setDescription('');
      setDueDate('');
      setError('');
      void qc.invalidateQueries({ queryKey: ['naac-calendar'] });
    },
    onError: (e) => setError(apiErrorMessage(e, 'Request failed')),
  });

  const events = calendarQ.data ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add calendar event</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Event type</Label>
            <select
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
            >
              {eventTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Due date *</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Description</Label>
            <textarea
              className="mt-1 min-h-[64px] w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <Button
              disabled={createMut.isPending || !title.trim() || !dueDate}
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Add event
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left">Title</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Due</th>
              <th className="px-3 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-muted-foreground">
                  No events scheduled.
                </td>
              </tr>
            ) : (
              events.map((e: NaacCalendarEvent) => (
                <tr key={e.id} className="border-t">
                  <td className="px-3 py-2">{e.title}</td>
                  <td className="px-3 py-2">{e.eventType}</td>
                  <td className="px-3 py-2">{new Date(e.dueDate).toLocaleDateString()}</td>
                  <td className="px-3 py-2">{e.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
