'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { GraduationCap } from 'lucide-react';
import {
  approveFeeConcession,
  fetchScholarships,
  requestFeeConcession,
} from '@/services/fee-cycle';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ScholarshipConcessionPanel() {
  const [studentId, setStudentId] = useState('');
  const [demandId, setDemandId] = useState('');
  const [schemeId, setSchemeId] = useState('');
  const [pendingId, setPendingId] = useState('');

  const schemesQ = useQuery({ queryKey: ['scholarships'], queryFn: fetchScholarships });
  const selected = schemesQ.data?.find((s) => s.id === schemeId);

  const applyMut = useMutation({
    mutationFn: () => {
      if (!selected || !studentId) throw new Error('Missing fields');
      return requestFeeConcession({
        studentId,
        demandId: demandId || undefined,
        schemeId,
        concessionType: selected.schemeType,
        calculationType: selected.calculationType,
        value: selected.value,
        reason: `${selected.name} applied`,
      });
    },
    onSuccess: (row) => setPendingId(row.id),
  });

  const approveMut = useMutation({
    mutationFn: () => approveFeeConcession(pendingId),
    onSuccess: () => setPendingId(''),
  });

  return (
    <Card className="glass-card border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5" />
          Scholarships & Concessions
        </CardTitle>
        <CardDescription>
          Merit, minority, management, sports, and staff-child schemes with approval workflow.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 md:grid-cols-2">
          {(schemesQ.data ?? []).map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSchemeId(s.id)}
              className={`rounded-xl border px-4 py-3 text-left transition ${
                schemeId === s.id ? 'border-primary bg-primary/5' : ''
              }`}
            >
              <p className="font-semibold">{s.name}</p>
              <p className="text-xs text-muted-foreground">
                {s.schemeType} · {s.code}
              </p>
              <p className="mt-1 text-sm">
                {s.calculationType === 'PERCENTAGE' ? `${s.value}%` : `₹${s.value}`}
              </p>
            </button>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Student ID</Label>
            <Input
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="UUID"
            />
          </div>
          <div>
            <Label>Demand ID (optional)</Label>
            <Input
              value={demandId}
              onChange={(e) => setDemandId(e.target.value)}
              placeholder="Target demand"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            disabled={!schemeId || !studentId || applyMut.isPending}
            onClick={() => applyMut.mutate()}
          >
            Request concession
          </Button>
          {pendingId ? (
            <Button
              variant="outline"
              disabled={approveMut.isPending}
              onClick={() => approveMut.mutate()}
            >
              Approve pending ({pendingId.slice(0, 8)}…)
            </Button>
          ) : null}
        </div>

        {!schemesQ.data?.length ? (
          <p className="text-sm text-muted-foreground">
            Run fee seeds or create scholarship schemes in admin.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
