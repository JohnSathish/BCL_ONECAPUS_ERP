'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Settings } from 'lucide-react';
import { fetchFeeSettings, updateFeeSettings } from '@/services/fee-cycle';
import type { CollectionModeKey } from '@/types/fee-cycle';
import { MonthlyFeeSetupGuide } from '@/components/fees-module/monthly-fee-setup-guide';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

const COLLECTION_MODE_ROWS: Array<{ key: CollectionModeKey; hint?: string }> = [
  { key: 'gateway', hint: 'Razorpay / student portal online pay' },
  { key: 'upi_qr', hint: 'Dynamic UPI QR at fee desk' },
  { key: 'sbi_icollect', hint: 'External entry — SBI iCollect' },
  { key: 'bank_transfer', hint: 'External entry — NEFT / RTGS / UPI ref' },
  { key: 'cash', hint: 'Requires Can Collect Cash permission' },
  { key: 'cheque', hint: 'Manual cheque collection at desk' },
  { key: 'dd', hint: 'Demand draft collection' },
  { key: 'scholarship', hint: 'Scholarship / concession posting' },
  { key: 'fee_waiver', hint: 'Fee waiver / adjustment entries' },
];

const MODE_LABELS: Record<CollectionModeKey, string> = {
  gateway: 'Online Gateway',
  upi_qr: 'UPI QR',
  sbi_icollect: 'SBI iCollect',
  bank_transfer: 'Bank Transfer',
  cash: 'Cash Collection',
  cheque: 'Cheque',
  dd: 'Demand Draft (DD)',
  scholarship: 'Scholarship Adjustment',
  fee_waiver: 'Fee Waiver',
};

export function FeeSettingsPanel() {
  const qc = useQueryClient();
  const settingsQ = useQuery({ queryKey: ['fee-settings'], queryFn: fetchFeeSettings });
  const s = settingsQ.data;
  const modes = s?.collectionModes;

  const saveMut = useMutation({
    mutationFn: (payload: Record<string, unknown>) => updateFeeSettings(payload),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['fee-settings'] }),
  });

  const toggleMode = (key: CollectionModeKey, enabled: boolean) => {
    if (!modes) return;
    saveMut.mutate({ collectionModes: { ...modes, [key]: enabled } });
  };

  if (!s || !modes) return <div className="text-sm text-muted-foreground">Loading settings…</div>;

  return (
    <div className="space-y-6">
      <Card className="glass-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Collection Modes
          </CardTitle>
          <CardDescription>
            Enable or disable payment methods for this institution. Desk, student portal, external
            entry, and reports respect these settings — no code changes required.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {COLLECTION_MODE_ROWS.map(({ key, hint }) => (
            <div key={key} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>{MODE_LABELS[key]}</Label>
                {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
              </div>
              <Switch checked={Boolean(modes[key])} onCheckedChange={(v) => toggleMode(key, v)} />
            </div>
          ))}
          <div className="space-y-1 sm:col-span-2">
            <Label>Cash receipt prefix</Label>
            <Input
              defaultValue={s.cashReceiptPrefix ?? 'DBC/CASH'}
              placeholder="DBC/CASH"
              onBlur={(e) => saveMut.mutate({ cashReceiptPrefix: e.target.value.trim() })}
            />
            <p className="text-xs text-muted-foreground">
              Cash receipts: {s.cashReceiptPrefix ?? 'DBC/CASH'}/2026/000001
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card border-0">
        <CardHeader>
          <CardTitle>Receipt templates</CardTitle>
          <CardDescription>
            Half A4 is recommended for college offices — two receipts fit on one sheet when cut.
            Changing the template regenerates PDFs on next download.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {(
            [
              {
                id: 'half',
                label: 'Half A4 receipt (recommended)',
                hint: 'Portrait · 210×148mm · 2 per A4 sheet',
              },
              {
                id: 'full',
                label: 'Full A4 receipt (detailed)',
                hint: 'Large layout with full panels',
              },
              { id: 'thermal', label: 'Thermal printer receipt', hint: '80mm roll printers' },
            ] as const
          ).map((opt) => (
            <label
              key={opt.id}
              className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <input
                type="radio"
                name="receiptTemplate"
                className="mt-1"
                checked={(s.receiptTemplate ?? 'half') === opt.id}
                onChange={() => saveMut.mutate({ metadata: { receiptTemplate: opt.id } })}
              />
              <div>
                <p className="font-medium">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.hint}</p>
              </div>
            </label>
          ))}
        </CardContent>
      </Card>

      <Card className="glass-card border-0">
        <CardHeader>
          <CardTitle>Student portal — monthly fees</CardTitle>
          <CardDescription>
            Control whether students can select future months on the fee calendar. Demands must
            still be generated by finance before a month becomes payable.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label>Allow advance monthly payment</Label>
              <p className="text-xs text-muted-foreground">
                When enabled, students can select future months that already have generated demands.
                When disabled, only pending (due) months are selectable.
              </p>
            </div>
            <Switch
              checked={Boolean(s.studentPortal?.allowAdvanceMonthlyPayment)}
              onCheckedChange={(v) =>
                saveMut.mutate({ metadata: { allowAdvanceMonthlyPayment: v } })
              }
            />
          </div>
          <p className="text-xs text-muted-foreground">
            To unlock months on the calendar, finance staff must generate monthly fee demands first
            (Fee Collection Desk → Generate monthly fees, or Monthly Fee Plans → bulk generate).
          </p>
        </CardContent>
      </Card>

      <MonthlyFeeSetupGuide />

      <Card className="glass-card border-0">
        <CardHeader>
          <CardTitle>General fee settings</CardTitle>
          <CardDescription>Due dates, late fees, receipt format, and enforcement.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Monthly due day</Label>
            <Input
              type="number"
              min={1}
              max={28}
              defaultValue={s.monthlyDueDay}
              onBlur={(e) => saveMut.mutate({ monthlyDueDay: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1">
            <Label>Receipt prefix (non-cash)</Label>
            <Input
              defaultValue={s.receiptPrefix}
              onBlur={(e) => saveMut.mutate({ receiptPrefix: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>Late fee amount (₹/day)</Label>
            <Input
              type="number"
              defaultValue={String(s.lateFeeAmount)}
              onBlur={(e) => saveMut.mutate({ lateFeeAmount: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1">
            <Label>Late fee mode</Label>
            <Input
              defaultValue={s.lateFeeMode}
              onBlur={(e) => saveMut.mutate({ lateFeeMode: e.target.value })}
              placeholder="PER_DAY | FIXED | PER_MONTH"
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label>Late fee enabled</Label>
            <Switch
              checked={s.lateFeeEnabled}
              onCheckedChange={(v) => saveMut.mutate({ lateFeeEnabled: v })}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label>Block hall ticket on dues</Label>
            <Switch
              checked={s.blockHallTicketOnDue}
              onCheckedChange={(v) => saveMut.mutate({ blockHallTicketOnDue: v })}
            />
          </div>
          <div className="space-y-1">
            <Label>QR / link expiry (minutes)</Label>
            <Input
              type="number"
              min={5}
              max={60}
              defaultValue={String(s.paymentRequestExpiryMinutes ?? 15)}
              onBlur={(e) =>
                saveMut.mutate({ paymentRequestExpiryMinutes: Number(e.target.value) })
              }
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label>Block registration on dues</Label>
            <Switch
              checked={s.blockRegistrationOnDue}
              onCheckedChange={(v) => saveMut.mutate({ blockRegistrationOnDue: v })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
