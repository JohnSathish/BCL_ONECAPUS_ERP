'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DateInput } from '@/components/ui/date-input';

type SessionOption = { id: string; name: string };

type Props = {
  canManage: boolean;
  sessions: SessionOption[];
  campusId: string;
  shiftId: string;
  onActivateOdd: () => void;
  onActivateEven: () => void;
  onProvision: () => void;
  onFreezeSemester: (semesterId: string) => void;
  onCreateSession: (payload: { name: string; startDate: string; endDate: string }) => void;
  onCreateBatch: (payload: {
    batchCode: string;
    admissionYear: number;
    entrySessionId: string;
    currentSemester: number;
  }) => void;
  semesterRows: { id: string; label: string; frozen: boolean }[];
  pending?: {
    odd?: boolean;
    even?: boolean;
    provision?: boolean;
    freeze?: boolean;
  };
};

const selectClass = 'h-10 w-full rounded-md border border-border bg-card px-3 text-sm';

export function LifecycleActionsPanel({
  canManage,
  sessions,
  campusId,
  shiftId,
  onActivateOdd,
  onActivateEven,
  onProvision,
  onFreezeSemester,
  onCreateSession,
  onCreateBatch,
  semesterRows,
  pending,
}: Props) {
  const [sessionName, setSessionName] = useState('');
  const [sessionStart, setSessionStart] = useState('');
  const [sessionEnd, setSessionEnd] = useState('');
  const [batchCode, setBatchCode] = useState('');
  const [admissionYear, setAdmissionYear] = useState(new Date().getFullYear());
  const [entrySessionId, setEntrySessionId] = useState('');
  const [currentSemester, setCurrentSemester] = useState(1);

  if (!canManage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>College admin role required to manage lifecycle.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Cycle activation</CardTitle>
          <CardDescription>
            ODD: Sem 1, 3, 5 · EVEN: Sem 2, 4, 6 — all active in parallel.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button type="button" disabled={pending?.odd} onClick={onActivateOdd}>
            {pending?.odd ? 'Activating…' : 'Activate ODD cycle'}
          </Button>
          <Button type="button" variant="outline" disabled={pending?.even} onClick={onActivateEven}>
            {pending?.even ? 'Activating…' : 'Activate EVEN cycle'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={pending?.provision}
            onClick={onProvision}
          >
            {pending?.provision ? 'Provisioning…' : 'Provision FYUGP (6 sem)'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create academic session</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            className={selectClass}
            placeholder="2026–2027"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
          />
          <DateInput className={selectClass} value={sessionStart} onChange={setSessionStart} />
          <DateInput className={selectClass} value={sessionEnd} onChange={setSessionEnd} />
          <Button
            type="button"
            variant="outline"
            disabled={!sessionName || !sessionStart || !sessionEnd}
            onClick={() => {
              onCreateSession({
                name: sessionName,
                startDate: sessionStart,
                endDate: sessionEnd,
              });
              setSessionName('');
              setSessionStart('');
              setSessionEnd('');
            }}
          >
            Create session
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create admission batch</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            className={selectClass}
            placeholder="BATCH-2026"
            value={batchCode}
            onChange={(e) => setBatchCode(e.target.value)}
          />
          <input
            type="number"
            className={selectClass}
            value={admissionYear}
            onChange={(e) => setAdmissionYear(Number(e.target.value))}
          />
          <select
            className={selectClass}
            value={entrySessionId}
            onChange={(e) => setEntrySessionId(e.target.value)}
          >
            <option value="">Entry session</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            max={6}
            className={selectClass}
            value={currentSemester}
            onChange={(e) => setCurrentSemester(Number(e.target.value))}
          />
          <Button
            type="button"
            variant="outline"
            disabled={!batchCode || !entrySessionId}
            onClick={() => {
              onCreateBatch({
                batchCode,
                admissionYear,
                entrySessionId,
                currentSemester,
              });
              setBatchCode('');
            }}
          >
            Create batch
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Semester freeze</CardTitle>
          <CardDescription>Lock attendance, registration, and marks.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {semesterRows.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 text-sm">
              <span>{s.label}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={s.frozen || pending?.freeze}
                onClick={() => onFreezeSemester(s.id)}
              >
                Freeze
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
