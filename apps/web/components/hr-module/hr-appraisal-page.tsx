'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, BarChart3, BookOpen, MessageSquare, UserCheck } from 'lucide-react';

import { GlassCard } from '@/components/erp/glass-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  createAppraisalCycle,
  fetchAppraisalCycles,
  fetchAppraisalRecords,
  launchAppraisalCycle,
  scoreAppraisal,
} from '@/services/hr';
import { apiErrorMessage } from '@/utils/api-error';

const KPI_AREAS = [
  { label: 'Attendance', icon: UserCheck },
  { label: 'Results', icon: BarChart3 },
  { label: 'Publications', icon: BookOpen },
  { label: 'LMS Activity', icon: Award },
  { label: 'Feedback', icon: MessageSquare },
];

export function HrAppraisalPage() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const now = new Date();
  const [message, setMessage] = useState('');
  const [cycleForm, setCycleForm] = useState({
    name: `Annual Appraisal ${now.getFullYear()}`,
    year: now.getFullYear(),
    startDate: `${now.getFullYear()}-01-01`,
    endDate: `${now.getFullYear()}-12-31`,
  });
  const [selectedCycleId, setSelectedCycleId] = useState('');

  const cyclesQ = useQuery({
    queryKey: ['hr', 'appraisal', 'cycles'],
    queryFn: fetchAppraisalCycles,
    enabled,
  });
  const recordsQ = useQuery({
    queryKey: ['hr', 'appraisal', 'records', selectedCycleId],
    queryFn: () => fetchAppraisalRecords({ cycleId: selectedCycleId || undefined }),
    enabled,
  });

  const createCycleMut = useMutation({
    mutationFn: () => createAppraisalCycle(cycleForm),
    onSuccess: () => {
      setMessage('Appraisal cycle created.');
      void qc.invalidateQueries({ queryKey: ['hr', 'appraisal'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Could not create cycle')),
  });

  const launchMut = useMutation({
    mutationFn: launchAppraisalCycle,
    onSuccess: () => {
      setMessage('Cycle launched for all active staff.');
      void qc.invalidateQueries({ queryKey: ['hr', 'appraisal'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Launch failed')),
  });

  const scoreMut = useMutation({
    mutationFn: ({ id, score }: { id: string; score: number }) =>
      scoreAppraisal(id, { role: 'HOD', score }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['hr', 'appraisal'] }),
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Performance Appraisal</h2>
        <p className="text-sm text-muted-foreground">
          Faculty KPI scorecards with attendance, research, and LMS metrics.
        </p>
      </div>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {KPI_AREAS.map(({ label, icon: Icon }) => (
          <GlassCard key={label} className="p-3">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{label}</span>
            </div>
          </GlassCard>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard className="space-y-3 p-4">
          <h3 className="font-semibold">Appraisal Cycle</h3>
          <Input
            value={cycleForm.name}
            onChange={(e) => setCycleForm({ ...cycleForm, name: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              value={cycleForm.startDate}
              onChange={(e) => setCycleForm({ ...cycleForm, startDate: e.target.value })}
            />
            <Input
              type="date"
              value={cycleForm.endDate}
              onChange={(e) => setCycleForm({ ...cycleForm, endDate: e.target.value })}
            />
          </div>
          <Button onClick={() => createCycleMut.mutate()} disabled={createCycleMut.isPending}>
            Create Cycle
          </Button>
        </GlassCard>

        <GlassCard className="p-4">
          <h3 className="mb-3 font-semibold">Cycles</h3>
          <ul className="space-y-2 text-sm">
            {(cyclesQ.data ?? []).map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded border px-3 py-2">
                <button
                  type="button"
                  className="text-left"
                  onClick={() => setSelectedCycleId(c.id)}
                >
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.status} · {c._count?.appraisals ?? 0} staff
                  </p>
                </button>
                {c.status === 'DRAFT' ? (
                  <Button size="sm" variant="outline" onClick={() => launchMut.mutate(c.id)}>
                    Launch
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </GlassCard>
      </div>

      <GlassCard className="p-4">
        <h3 className="mb-3 font-semibold">Staff Scorecards</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-muted-foreground">
              <th className="py-2">Staff</th>
              <th>Self</th>
              <th>HOD</th>
              <th>Final</th>
              <th>Status</th>
              <th className="text-right">Score</th>
            </tr>
          </thead>
          <tbody>
            {(recordsQ.data ?? []).map((r) => (
              <tr key={r.id} className="border-b border-border/60">
                <td className="py-2">{r.staffProfile?.fullName}</td>
                <td className="py-2">{r.selfScore ?? '—'}</td>
                <td className="py-2">{r.hodScore ?? '—'}</td>
                <td className="py-2 font-semibold">{r.finalScore ?? '—'}</td>
                <td className="py-2">{r.status}</td>
                <td className="py-2 text-right">
                  {r.status !== 'FINALIZED' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => scoreMut.mutate({ id: r.id, score: 75 })}
                    >
                      Score 75
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>
    </div>
  );
}
