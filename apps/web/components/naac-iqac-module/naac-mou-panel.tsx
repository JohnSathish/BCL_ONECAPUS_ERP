'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  addNaacMouActivity,
  createNaacMou,
  fetchNaacConstants,
  fetchNaacMous,
} from '@/services/naac-iqac';
import type { NaacMou } from '@/types/naac-iqac';
import { apiErrorMessage } from '@/utils/api-error';

export function NaacMouPanel() {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const [partnerType, setPartnerType] = useState('industry');
  const [partnerName, setPartnerName] = useState('');
  const [signedAt, setSignedAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [activityMouId, setActivityMouId] = useState('');
  const [activityTitle, setActivityTitle] = useState('');
  const [activityDate, setActivityDate] = useState('');

  const constantsQ = useQuery({ queryKey: ['naac-constants'], queryFn: fetchNaacConstants });
  const mousQ = useQuery({ queryKey: ['naac-mous'], queryFn: fetchNaacMous });

  const partnerTypes = (constantsQ.data as { mouPartnerTypes?: string[] })?.mouPartnerTypes ?? [
    'industry',
    'university',
    'ngo',
    'research',
  ];

  const createMut = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.append('partnerType', partnerType);
      form.append('partnerName', partnerName);
      if (signedAt) form.append('signedAt', signedAt);
      if (expiresAt) form.append('expiresAt', expiresAt);
      if (notes) form.append('notes', notes);
      if (file) form.append('file', file);
      return createNaacMou(form);
    },
    onSuccess: () => {
      setPartnerName('');
      setNotes('');
      setFile(null);
      setError('');
      void qc.invalidateQueries({ queryKey: ['naac-mous'] });
    },
    onError: (e) => setError(apiErrorMessage(e, 'Request failed')),
  });

  const activityMut = useMutation({
    mutationFn: () =>
      addNaacMouActivity(activityMouId, {
        title: activityTitle,
        activityDate: activityDate || undefined,
      }),
    onSuccess: () => {
      setActivityTitle('');
      setActivityDate('');
      void qc.invalidateQueries({ queryKey: ['naac-mous'] });
    },
    onError: (e) => setError(apiErrorMessage(e, 'Request failed')),
  });

  const mous = mousQ.data ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Register MoU</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Partner type</Label>
            <select
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={partnerType}
              onChange={(e) => setPartnerType(e.target.value)}
            >
              {partnerTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Partner name *</Label>
            <Input value={partnerName} onChange={(e) => setPartnerName(e.target.value)} />
          </div>
          <div>
            <Label>Signed date</Label>
            <Input type="date" value={signedAt} onChange={(e) => setSignedAt(e.target.value)} />
          </div>
          <div>
            <Label>Expires</Label>
            <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div>
            <Label>MoU document</Label>
            <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="flex items-end">
            <Button
              disabled={createMut.isPending || !partnerName.trim()}
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Save MoU
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add MoU activity</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div>
            <Label>MoU</Label>
            <select
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={activityMouId}
              onChange={(e) => setActivityMouId(e.target.value)}
            >
              <option value="">— Select —</option>
              {mous.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.partnerName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Activity title</Label>
            <Input value={activityTitle} onChange={(e) => setActivityTitle(e.target.value)} />
          </div>
          <div>
            <Label>Date</Label>
            <Input
              type="date"
              value={activityDate}
              onChange={(e) => setActivityDate(e.target.value)}
            />
          </div>
          <div>
            <Button
              disabled={activityMut.isPending || !activityMouId || !activityTitle}
              onClick={() => activityMut.mutate()}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add activity
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left">Partner</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Activities</th>
            </tr>
          </thead>
          <tbody>
            {mous.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-muted-foreground">
                  No MoUs registered.
                </td>
              </tr>
            ) : (
              mous.map((m: NaacMou) => (
                <tr key={m.id} className="border-t">
                  <td className="px-3 py-2">{m.partnerName}</td>
                  <td className="px-3 py-2">{m.partnerType}</td>
                  <td className="px-3 py-2">{m.status}</td>
                  <td className="px-3 py-2">{m.activities?.length ?? 0}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
