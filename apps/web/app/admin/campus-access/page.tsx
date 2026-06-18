'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Copy, ExternalLink, Plus } from 'lucide-react';
import Link from 'next/link';
import { AdminPageHeader } from '@/components/administration-module/admin-page-header';
import { AdminShell } from '@/components/administration-module/ui/admin-shell';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRequireAuth } from '@/hooks/use-auth';
import { createAccessPoint, createKioskDevice, fetchAccessPoints } from '@/services/campus-access';
import { apiErrorMessage } from '@/utils/api-error';

export default function CampusAccessAdminPage() {
  useRequireAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    code: 'library',
    name: 'Library Entry Gate',
    accessType: 'LIBRARY',
    location: 'Main Library',
  });
  const [deviceName, setDeviceName] = useState('Scanner 1');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [issuedUrl, setIssuedUrl] = useState<string | null>(null);

  const pointsQ = useQuery({
    queryKey: ['cams', 'access-points'],
    queryFn: fetchAccessPoints,
  });

  const createMut = useMutation({
    mutationFn: () => createAccessPoint(form),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cams'] }),
  });

  const deviceMut = useMutation({
    mutationFn: () => createKioskDevice(selectedId!, deviceName),
    onSuccess: (data) => {
      setIssuedUrl(data.kioskUrl);
      qc.invalidateQueries({ queryKey: ['cams'] });
    },
  });

  return (
    <DashboardShell role="admin" title="Campus Access">
      <AdminShell>
        <AdminPageHeader
          title="Campus Access Management (CAMS)"
          subtitle="Configure access points, kiosk URLs, and entry analytics"
          actions={
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/campus-access/dashboard">Live dashboard</Link>
            </Button>
          }
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border bg-card p-5">
            <h2 className="font-semibold">New access point</h2>
            <div className="mt-4 space-y-3">
              <Input
                placeholder="Code (URL slug, e.g. library)"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toLowerCase() })}
              />
              <Input
                placeholder="Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <Input
                placeholder="Type (LIBRARY, HOSTEL, GATE, LAB, EVENT)"
                value={form.accessType}
                onChange={(e) => setForm({ ...form, accessType: e.target.value.toUpperCase() })}
              />
              <Input
                placeholder="Location"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
              <Button disabled={createMut.isPending} onClick={() => createMut.mutate()}>
                <Plus className="mr-2 h-4 w-4" /> Create access point
              </Button>
              {createMut.isError ? (
                <p className="text-sm text-destructive">{apiErrorMessage(createMut.error)}</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5">
            <h2 className="font-semibold">Issue kiosk URL</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Select an access point and generate a tokenized full-screen URL for the gate PC.
            </p>
            <div className="mt-4 space-y-3">
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={selectedId ?? ''}
                onChange={(e) => setSelectedId(e.target.value || null)}
              >
                <option value="">Select access point…</option>
                {(pointsQ.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
              <Input
                placeholder="Device name"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
              />
              <Button
                disabled={!selectedId || deviceMut.isPending}
                onClick={() => deviceMut.mutate()}
              >
                Generate kiosk URL
              </Button>
              {issuedUrl ? (
                <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                  <p className="break-all font-mono text-xs">{issuedUrl}</p>
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void navigator.clipboard.writeText(issuedUrl)}
                    >
                      <Copy className="mr-1 h-3 w-3" /> Copy
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <a href={issuedUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-1 h-3 w-3" /> Open kiosk
                      </a>
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border bg-card p-5">
          <h2 className="font-semibold">Access points</h2>
          <ul className="mt-4 divide-y">
            {(pointsQ.data ?? []).map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    /kiosk/{p.code} · {p.accessType}
                    {p.location ? ` · ${p.location}` : ''}
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>{p.devices.length} device(s)</p>
                  <p>{p._count?.logs ?? 0} log entries</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </AdminShell>
    </DashboardShell>
  );
}
