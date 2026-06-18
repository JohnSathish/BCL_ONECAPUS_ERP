'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, PackageCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  fetchLibraryCopyIncidents,
  notifyLibraryDueTomorrow,
  replaceLibraryCopyIncident,
  reportLibraryCopyIncident,
  resolveLibraryCopyIncident,
} from '@/services/library';
import { apiErrorMessage } from '@/utils/api-error';

export function LibraryIncidentsWorkspace() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [message, setMessage] = useState('');
  const [barcode, setBarcode] = useState('');
  const [notes, setNotes] = useState('');
  const [incidentType, setIncidentType] = useState<'LOST' | 'DAMAGED'>('LOST');
  const [statusFilter, setStatusFilter] = useState<string>('OPEN');

  const incidents = useQuery({
    queryKey: ['library', 'incidents', statusFilter],
    queryFn: () =>
      fetchLibraryCopyIncidents({
        status: statusFilter || undefined,
      }),
    enabled,
  });

  const reportMut = useMutation({
    mutationFn: () =>
      reportLibraryCopyIncident({
        copyBarcode: barcode.trim(),
        incidentType,
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      setMessage('Incident recorded');
      setBarcode('');
      setNotes('');
      void qc.invalidateQueries({ queryKey: ['library', 'incidents'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e)),
  });

  const replaceMut = useMutation({
    mutationFn: (id: string) => replaceLibraryCopyIncident(id),
    onSuccess: () => {
      setMessage('Copy replaced — incident resolved');
      void qc.invalidateQueries({ queryKey: ['library', 'incidents'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e)),
  });

  const resolveMut = useMutation({
    mutationFn: (id: string) => resolveLibraryCopyIncident(id, 'Closed without replacement'),
    onSuccess: () => {
      setMessage('Incident closed');
      void qc.invalidateQueries({ queryKey: ['library', 'incidents'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e)),
  });

  const dueTomorrowMut = useMutation({
    mutationFn: () => notifyLibraryDueTomorrow(),
    onSuccess: (r) => {
      setMessage(
        r.skipped
          ? 'Due-tomorrow reminders disabled in settings'
          : `Due-tomorrow reminders sent: ${r.sent} of ${r.checked} loans`,
      );
    },
    onError: (e) => setMessage(apiErrorMessage(e)),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Lost / Damaged / Replaced</h1>
          <p className="text-sm text-muted-foreground">
            Report copy incidents, auto-close loans, apply fines, and register replacements
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={dueTomorrowMut.isPending}
          onClick={() => dueTomorrowMut.mutate()}
        >
          Run due-tomorrow reminders
        </Button>
      </div>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <section className="rounded-xl border p-4">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <AlertTriangle className="h-4 w-4" />
          Report incident
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={incidentType === 'LOST' ? 'default' : 'outline'}
            onClick={() => setIncidentType('LOST')}
          >
            Lost
          </Button>
          <Button
            size="sm"
            variant={incidentType === 'DAMAGED' ? 'default' : 'outline'}
            onClick={() => setIncidentType('DAMAGED')}
          >
            Damaged
          </Button>
        </div>
        <div className="mt-3 grid max-w-xl gap-2">
          <Input
            placeholder="Copy barcode or LIB:C: scan"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
          />
          <Input
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <Button
            disabled={!barcode.trim() || reportMut.isPending}
            onClick={() => reportMut.mutate()}
          >
            {reportMut.isPending ? 'Saving…' : 'Report'}
          </Button>
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap gap-2">
          {(['OPEN', 'RESOLVED', 'CLOSED', ''] as const).map((s) => (
            <Button
              key={s || 'all'}
              size="sm"
              variant={statusFilter === s ? 'default' : 'outline'}
              onClick={() => setStatusFilter(s)}
            >
              {s || 'All'}
            </Button>
          ))}
        </div>

        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="p-2 text-left">Type</th>
                <th className="p-2 text-left">Book</th>
                <th className="p-2 text-left">Barcode</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Charge</th>
                <th className="p-2 text-left">Reported</th>
                <th className="p-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {incidents.data?.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="p-2">{row.incidentType}</td>
                  <td className="p-2">{row.copy?.book?.title ?? '—'}</td>
                  <td className="p-2 font-mono text-xs">{row.copy?.barcode ?? '—'}</td>
                  <td className="p-2">{row.status}</td>
                  <td className="p-2">
                    {row.chargeAmount != null ? `₹${row.chargeAmount.toFixed(2)}` : '—'}
                  </td>
                  <td className="p-2">{new Date(row.createdAt).toLocaleDateString()}</td>
                  <td className="p-2">
                    {row.status === 'OPEN' ? (
                      <div className="flex flex-wrap gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={replaceMut.isPending}
                          onClick={() => replaceMut.mutate(row.id)}
                        >
                          <PackageCheck className="mr-1 h-3 w-3" />
                          Replace
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={resolveMut.isPending}
                          onClick={() => resolveMut.mutate(row.id)}
                        >
                          Close
                        </Button>
                      </div>
                    ) : row.replacementCopy ? (
                      <span className="font-mono text-xs">{row.replacementCopy.barcode}</span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
              {!incidents.data?.length && !incidents.isLoading ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">
                    No incidents
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
