'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GlassCard } from '@/components/erp/glass-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  bulkInterviewCallLettersPdfUrl,
  fetchRecruitmentInterviews,
  interviewCallLetterPdfUrl,
  interviewCallLetterPreviewUrl,
  scheduleRecruitmentInterview,
  updateRecruitmentInterview,
  uploadRecruitmentInterviewMinutes,
} from '@/services/hr';

export function HrRecruitmentInterviewsPanel() {
  const qc = useQueryClient();
  const [bulkDate, setBulkDate] = useState(new Date().toISOString().slice(0, 10));
  const [form, setForm] = useState({
    applicationId: '',
    scheduledAt: '',
    venue: '',
    panelMembers: '',
  });

  const interviewsQ = useQuery({
    queryKey: ['hr', 'recruitment', 'interviews'],
    queryFn: () => fetchRecruitmentInterviews(),
  });

  const scheduleMut = useMutation({
    mutationFn: () =>
      scheduleRecruitmentInterview({
        applicationId: form.applicationId,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        venue: form.venue,
        panelJson: form.panelMembers
          ? { members: form.panelMembers.split(',').map((m) => m.trim()) }
          : undefined,
      }),
    onSuccess: () => {
      setForm({ applicationId: '', scheduledAt: '', venue: '', panelMembers: '' });
      void qc.invalidateQueries({ queryKey: ['hr', 'recruitment'] });
    },
  });

  const scoreMut = useMutation({
    mutationFn: ({ id, score, notes }: { id: string; score: number; notes?: string }) =>
      updateRecruitmentInterview(id, { score, status: 'COMPLETED', notes }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['hr', 'recruitment', 'interviews'] }),
  });

  const minutesMut = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      uploadRecruitmentInterviewMinutes(id, file),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['hr', 'recruitment', 'interviews'] }),
  });

  const interviews = interviewsQ.data ?? [];

  return (
    <div className="space-y-4">
      <GlassCard className="flex flex-wrap items-end gap-3 p-4">
        <div>
          <Label className="text-xs">Bulk call letters for date</Label>
          <Input type="date" value={bulkDate} onChange={(e) => setBulkDate(e.target.value)} />
        </div>
        <Button variant="outline" asChild>
          <a href={bulkInterviewCallLettersPdfUrl(bulkDate)} target="_blank" rel="noreferrer">
            Download all call letters (PDF)
          </a>
        </Button>
      </GlassCard>

      <div className="grid gap-4 lg:grid-cols-3">
        <GlassCard className="space-y-3 p-4 lg:col-span-1">
          <h3 className="font-semibold">Schedule Interview</h3>
          <div>
            <Label>Application ID</Label>
            <Input
              value={form.applicationId}
              onChange={(e) => setForm((f) => ({ ...f, applicationId: e.target.value }))}
              placeholder="UUID from ATS card"
            />
          </div>
          <div>
            <Label>Date & time</Label>
            <Input
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
            />
          </div>
          <div>
            <Label>Venue</Label>
            <Input
              value={form.venue}
              onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))}
            />
          </div>
          <div>
            <Label>Panel (comma-separated)</Label>
            <Input
              value={form.panelMembers}
              onChange={(e) => setForm((f) => ({ ...f, panelMembers: e.target.value }))}
              placeholder="Principal, HOD Economics"
            />
          </div>
          <Button
            disabled={!form.applicationId || !form.scheduledAt}
            onClick={() => scheduleMut.mutate()}
          >
            Schedule & notify candidate
          </Button>
        </GlassCard>

        <GlassCard className="overflow-hidden lg:col-span-2">
          <div className="border-b px-4 py-3 font-medium">Interview Schedule</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-4 py-2">Candidate</th>
                <th className="px-4 py-2">When</th>
                <th className="px-4 py-2">Venue</th>
                <th className="px-4 py-2">Score</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {interviews.map((iv) => (
                <tr key={iv.id} className="border-b">
                  <td className="px-4 py-2">
                    {iv.application?.fullName}
                    <br />
                    <span className="text-xs text-muted-foreground">
                      {iv.application?.vacancy?.title}
                    </span>
                  </td>
                  <td className="px-4 py-2">{new Date(iv.scheduledAt).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2">{iv.venue ?? '—'}</td>
                  <td className="px-4 py-2">{iv.score ?? '—'}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button size="sm" variant="outline" asChild>
                          <a
                            href={interviewCallLetterPdfUrl(iv.id)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Call letter
                          </a>
                        </Button>
                        <Button size="sm" variant="ghost" asChild>
                          <a
                            href={interviewCallLetterPreviewUrl(iv.id)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Preview
                          </a>
                        </Button>
                      </div>
                      {iv.status !== 'COMPLETED' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const score = window.prompt('Enter score (0-100)');
                            if (score) {
                              scoreMut.mutate({
                                id: iv.id,
                                score: Number(score),
                                notes: 'Interview completed',
                              });
                            }
                          }}
                        >
                          Record score
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">{iv.status}</span>
                      )}
                      <label className="cursor-pointer text-xs text-primary underline">
                        Upload minutes
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) minutesMut.mutate({ id: iv.id, file });
                            e.target.value = '';
                          }}
                        />
                      </label>
                    </div>
                  </td>
                </tr>
              ))}
              {!interviews.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No interviews scheduled.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </GlassCard>
      </div>
    </div>
  );
}
