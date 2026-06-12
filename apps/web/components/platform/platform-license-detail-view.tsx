'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import {
  activatePlatformLicense,
  createPlatformLicense,
  extendPlatformLicense,
  fetchPlatformLicense,
  fetchPlatformLicenseAudit,
  renewPlatformLicense,
  suspendPlatformLicense,
} from '@/services/platform-licensing';

type ActionMode = 'renew' | 'extend' | 'suspend' | 'create' | null;

export function PlatformLicenseDetailView({ tenantId }: { tenantId: string }) {
  const enabled = useAuthQueryEnabled();
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canManage = can('platform:licenses:manage');

  const [mode, setMode] = useState<ActionMode>(null);
  const [newExpiryDate, setNewExpiryDate] = useState('');
  const [amount, setAmount] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [notes, setNotes] = useState('');
  const [suspendReason, setSuspendReason] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));

  const detail = useQuery({
    queryKey: ['platform', 'license', tenantId],
    queryFn: () => fetchPlatformLicense(tenantId),
    enabled: enabled && Boolean(tenantId),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['platform'] });
  };

  const renewMut = useMutation({
    mutationFn: () =>
      renewPlatformLicense(tenantId, {
        newExpiryDate,
        amount: amount ? Number(amount) : undefined,
        invoiceNumber: invoiceNumber || undefined,
        paymentMode: paymentMode || undefined,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      setMode(null);
      invalidate();
    },
  });

  const extendMut = useMutation({
    mutationFn: () => extendPlatformLicense(tenantId, { newExpiryDate, notes: notes || undefined }),
    onSuccess: () => {
      setMode(null);
      invalidate();
    },
  });

  const suspendMut = useMutation({
    mutationFn: () => suspendPlatformLicense(tenantId, suspendReason),
    onSuccess: () => {
      setMode(null);
      invalidate();
    },
  });

  const activateMut = useMutation({
    mutationFn: () => activatePlatformLicense(tenantId),
    onSuccess: invalidate,
  });

  const createMut = useMutation({
    mutationFn: () =>
      createPlatformLicense({
        tenantId,
        licenseType: 'ANNUAL_1Y',
        subscriptionPlan: 'Annual License',
        startDate,
        gracePeriodDays: 15,
        maxStudents: 5000,
        maxStaff: 500,
        storageLimitMb: 10240,
      }),
    onSuccess: () => {
      setMode(null);
      invalidate();
    },
  });

  const audit = useQuery({
    queryKey: ['platform', 'license', tenantId, 'audit'],
    queryFn: () => fetchPlatformLicenseAudit(tenantId),
    enabled: enabled && Boolean(tenantId) && Boolean(detail.data?.license),
  });

  if (detail.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading license…</p>;
  }

  if (detail.isError || !detail.data) {
    return <p className="text-sm text-destructive">License not found.</p>;
  }

  const { tenant, license, usage } = detail.data;

  if (!license) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link href="/platform/licenses">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back
            </Link>
          </Button>
          <div>
            <h2 className="text-lg font-semibold">{tenant.name}</h2>
            <p className="text-sm text-muted-foreground">No license configured</p>
          </div>
        </div>
        <Card>
          <CardContent className="space-y-3 py-6">
            <p className="text-sm text-muted-foreground">
              Students: {usage.currentStudents} · Staff: {usage.currentStaff}
            </p>
            {canManage ? <Button onClick={() => setMode('create')}>Create license</Button> : null}
          </CardContent>
        </Card>
        <Dialog open={mode === 'create'} onOpenChange={(open) => !open && setMode(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create license</DialogTitle>
              <DialogDescription>
                Provision a new annual license for this institution.
              </DialogDescription>
            </DialogHeader>
            <div>
              <Label htmlFor="create-start">Start date</Label>
              <Input
                id="create-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMode(null)}>
                Cancel
              </Button>
              <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  const status = String(license.status ?? 'ACTIVE');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/platform/licenses">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Link>
        </Button>
        <div>
          <h2 className="text-lg font-semibold">{tenant.name}</h2>
          <p className="text-sm text-muted-foreground">{String(license.licenseNumber)}</p>
        </div>
        <Badge
          variant={status === 'SUSPENDED' || status === 'EXPIRED' ? 'destructive' : 'secondary'}
        >
          {status.replace('_', ' ')}
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">License</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground">Plan</p>
              <p>{String(license.subscriptionPlan)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Type</p>
              <p>{String(license.licenseType)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Expiry</p>
              <p>
                {license.expiryDate
                  ? new Date(String(license.expiryDate)).toLocaleDateString()
                  : 'Lifetime'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Days remaining</p>
              <p>{license.daysRemaining ?? '—'}</p>
            </div>
            {license.internalNotes ? (
              <div className="sm:col-span-2">
                <p className="text-muted-foreground">Internal notes</p>
                <p className="whitespace-pre-wrap">{String(license.internalNotes)}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Usage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Students: {usage.currentStudents.toLocaleString()}</p>
            <p>Staff: {usage.currentStaff.toLocaleString()}</p>
            <p>Storage: {usage.fileStorageMb} MB</p>
          </CardContent>
        </Card>
      </div>

      {canManage ? (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setMode('renew')}>Renew</Button>
          <Button variant="outline" onClick={() => setMode('extend')}>
            Extend
          </Button>
          {status === 'SUSPENDED' ? (
            <Button
              variant="secondary"
              onClick={() => activateMut.mutate()}
              disabled={activateMut.isPending}
            >
              Activate
            </Button>
          ) : (
            <Button variant="destructive" onClick={() => setMode('suspend')}>
              Suspend
            </Button>
          )}
        </div>
      ) : null}

      {license.renewals?.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Renewal history</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">New expiry</th>
                  <th className="pb-2 pr-4">Amount</th>
                  <th className="pb-2 pr-4">Invoice</th>
                  <th className="pb-2">Payment</th>
                </tr>
              </thead>
              <tbody>
                {license.renewals.map((r) => (
                  <tr key={r.id} className="border-b border-border/50">
                    <td className="py-2 pr-4">{new Date(r.renewedAt).toLocaleDateString()}</td>
                    <td className="py-2 pr-4">{new Date(r.newExpiryDate).toLocaleDateString()}</td>
                    <td className="py-2 pr-4">{r.amount ?? '—'}</td>
                    <td className="py-2 pr-4">{r.invoiceNumber ?? '—'}</td>
                    <td className="py-2">{r.paymentMode ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}

      {audit.data?.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Audit trail</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4">When</th>
                  <th className="pb-2 pr-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {audit.data.map((row) => (
                  <tr key={row.id} className="border-b border-border/50">
                    <td className="py-2 pr-4">{new Date(row.createdAt).toLocaleString()}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{row.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={mode === 'renew'} onOpenChange={(open) => !open && setMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renew license</DialogTitle>
            <DialogDescription>Record renewal and update expiry date.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="renew-expiry">New expiry date</Label>
              <Input
                id="renew-expiry"
                type="date"
                value={newExpiryDate}
                onChange={(e) => setNewExpiryDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="renew-amount">Amount (₹)</Label>
              <Input
                id="renew-amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="renew-invoice">Invoice number</Label>
              <Input
                id="renew-invoice"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="renew-payment">Payment mode</Label>
              <Input
                id="renew-payment"
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="renew-notes">Notes</Label>
              <Input id="renew-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMode(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => renewMut.mutate()}
              disabled={!newExpiryDate || renewMut.isPending}
            >
              Save renewal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mode === 'extend'} onOpenChange={(open) => !open && setMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extend license</DialogTitle>
            <DialogDescription>Extend expiry without a full renewal record.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="extend-expiry">New expiry date</Label>
              <Input
                id="extend-expiry"
                type="date"
                value={newExpiryDate}
                onChange={(e) => setNewExpiryDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="extend-notes">Notes</Label>
              <Input id="extend-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMode(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => extendMut.mutate()}
              disabled={!newExpiryDate || extendMut.isPending}
            >
              Extend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mode === 'suspend'} onOpenChange={(open) => !open && setMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend license</DialogTitle>
            <DialogDescription>
              Writes will be blocked immediately for this tenant.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="suspend-reason">Reason</Label>
            <Input
              id="suspend-reason"
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMode(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => suspendMut.mutate()}
              disabled={!suspendReason.trim() || suspendMut.isPending}
            >
              Suspend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
