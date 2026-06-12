'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Search, Users } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchTransportAlerts, searchTransportStudents } from '@/services/transport';
import type { TransportCapacityAlert, TransportStudentOption } from '@/types/transport';

export function TransportStudentPicker({
  value,
  onSelect,
}: {
  value?: string;
  onSelect: (student: TransportStudentOption) => void;
}) {
  const enabled = useAuthQueryEnabled();
  const [search, setSearch] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('');

  const results = useQuery({
    queryKey: ['transport', 'students', search],
    queryFn: () => searchTransportStudents({ q: search, limit: 20 }),
    enabled: enabled && search.trim().length >= 2,
  });

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Search student name or enrollment no."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {value && selectedLabel ? (
        <p className="text-xs text-muted-foreground">Selected: {selectedLabel}</p>
      ) : null}
      {search.length >= 2 ? (
        <ul className="max-h-40 overflow-y-auto rounded border text-sm">
          {results.data?.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-muted/50"
                onClick={() => {
                  onSelect(s);
                  setSelectedLabel(`${s.fullName} (${s.enrollmentNumber})`);
                  setSearch('');
                }}
              >
                <span>{s.fullName}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {s.enrollmentNumber}
                </span>
              </button>
            </li>
          ))}
          {!results.data?.length && !results.isLoading ? (
            <li className="px-3 py-2 text-muted-foreground">No students found</li>
          ) : null}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Type at least 2 characters to search</p>
      )}
    </div>
  );
}

function alertBadge(severity: string) {
  if (severity === 'CRITICAL') return 'bg-destructive/10 text-destructive';
  if (severity === 'WARNING') return 'bg-amber-500/10 text-amber-700';
  return 'bg-muted text-muted-foreground';
}

export function TransportCapacityAlertsPanel() {
  const enabled = useAuthQueryEnabled();
  const alerts = useQuery({
    queryKey: ['transport', 'alerts'],
    queryFn: fetchTransportAlerts,
    enabled,
    refetchInterval: 30000,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5" />
        <h1 className="text-lg font-semibold">Capacity Alerts</h1>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="p-2 text-left">Route</th>
            <th className="p-2 text-left">Load</th>
            <th className="p-2 text-left">Utilization</th>
            <th className="p-2 text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          {alerts.data?.map((a: TransportCapacityAlert) => (
            <tr key={a.routeId} className="border-t">
              <td className="p-2 font-mono">
                {a.code} — {a.name}
              </td>
              <td className="p-2">
                {a.assigned}/{a.capacity || '—'}
              </td>
              <td className="p-2">{a.utilizationPct}%</td>
              <td className="p-2">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${alertBadge(a.severity)}`}
                >
                  {a.atCapacity ? 'At capacity' : 'Near capacity'}
                </span>
              </td>
            </tr>
          ))}
          {!alerts.data?.length ? (
            <tr>
              <td colSpan={4} className="p-4 text-center text-muted-foreground">
                All routes within capacity
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

export function TransportAssignmentDeskHint() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
      <Users className="h-4 w-4" />
      Search and pick a student below — parents are notified automatically when guardians are on
      file.
    </div>
  );
}
