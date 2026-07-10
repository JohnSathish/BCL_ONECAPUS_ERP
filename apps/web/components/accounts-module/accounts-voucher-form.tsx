'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Minus, Plus, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AccountsPageShell } from '@/components/accounts-module/accounts-page-shell';
import { AccountsPanel, formatInr } from '@/components/accounts-module/accounts-ui';
import {
  createVoucher,
  fetchVoucher,
  fetchLedgers,
  fetchVoucherTypes,
  updateVoucher,
  type CreateVoucherPayload,
} from '@/services/accounting';
import type { AccountingVoucherLine } from '@/types/accounting';
import { apiErrorMessage } from '@/utils/api-error';

const VOUCHER_TYPE_CODES = ['RECEIPT', 'PAYMENT', 'JOURNAL', 'CONTRA'] as const;

const TYPE_LABELS: Record<(typeof VOUCHER_TYPE_CODES)[number], string> = {
  RECEIPT: 'Receipt Voucher',
  PAYMENT: 'Payment Voucher',
  JOURNAL: 'Journal Entry',
  CONTRA: 'Contra / Cash Deposit',
};

function emptyLine(): AccountingVoucherLine {
  return { ledgerAccountId: '', entryType: 'DEBIT', amount: 0 };
}

export function AccountsVoucherForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const typeCode = (searchParams.get('type') ?? '').toUpperCase();
  const voucherId = searchParams.get('id');
  const isEditMode = Boolean(voucherId);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [voucherForm, setVoucherForm] = useState<CreateVoucherPayload>({
    voucherTypeId: '',
    voucherDate: new Date().toISOString().slice(0, 10),
    narration: '',
    paymentMode: 'CASH',
    lines: [emptyLine(), { ...emptyLine(), entryType: 'CREDIT' }],
  });

  const voucherTypesQ = useQuery({
    queryKey: ['accounting', 'voucher-types'],
    queryFn: fetchVoucherTypes,
  });
  const ledgersQ = useQuery({
    queryKey: ['accounting', 'ledgers', 'voucher-form'],
    queryFn: () => fetchLedgers({ limit: 300 }),
  });
  const voucherQ = useQuery({
    queryKey: ['accounting', 'voucher', voucherId],
    queryFn: () => fetchVoucher(voucherId as string),
    enabled: Boolean(voucherId),
  });

  useEffect(() => {
    if (isEditMode) return;
    if (!voucherTypesQ.data?.length) return;
    const match = voucherTypesQ.data.find(
      (vt) => vt.code === typeCode || vt.name.toUpperCase().includes(typeCode),
    );
    if (match) {
      setVoucherForm((prev) => ({
        ...prev,
        voucherTypeId: match.id,
        narration:
          prev.narration || (TYPE_LABELS[match.code as keyof typeof TYPE_LABELS] ?? match.name),
      }));
    }
  }, [isEditMode, typeCode, voucherTypesQ.data]);

  useEffect(() => {
    if (!voucherQ.data) return;
    setVoucherForm({
      voucherTypeId: voucherQ.data.voucherType?.id ?? '',
      voucherDate: voucherQ.data.voucherDate.slice(0, 10),
      narration: voucherQ.data.narration ?? '',
      referenceNo: voucherQ.data.referenceNo ?? '',
      chequeNo: voucherQ.data.chequeNo ?? '',
      paymentMode: voucherQ.data.paymentMode ?? 'CASH',
      lines: voucherQ.data.lines?.map((line) => ({
        ledgerAccountId: line.ledgerAccountId,
        entryType: line.entryType,
        amount: Number(line.amount),
      })) ?? [emptyLine(), { ...emptyLine(), entryType: 'CREDIT' }],
    });
  }, [voucherQ.data]);

  const createVoucherM = useMutation({
    mutationFn: createVoucher,
    onSuccess: () => {
      setMessage('Voucher saved as draft');
      setError('');
      qc.invalidateQueries({ queryKey: ['accounting', 'vouchers'] });
      router.push('/admin/accounts/vouchers');
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });
  const updateVoucherM = useMutation({
    mutationFn: (payload: CreateVoucherPayload) => updateVoucher(voucherId as string, payload),
    onSuccess: () => {
      setMessage('Draft voucher updated');
      setError('');
      qc.invalidateQueries({ queryKey: ['accounting', 'vouchers'] });
      qc.invalidateQueries({ queryKey: ['accounting', 'voucher', voucherId] });
      router.push('/admin/accounts/vouchers');
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const voucherDebit = voucherForm.lines
    .filter((l) => l.entryType === 'DEBIT')
    .reduce((sum, l) => sum + Number(l.amount), 0);
  const voucherCredit = voucherForm.lines
    .filter((l) => l.entryType === 'CREDIT')
    .reduce((sum, l) => sum + Number(l.amount), 0);

  const pageTitle = useMemo(() => {
    if (isEditMode) return 'Edit Draft Voucher';
    if (typeCode && TYPE_LABELS[typeCode as keyof typeof TYPE_LABELS]) {
      return TYPE_LABELS[typeCode as keyof typeof TYPE_LABELS];
    }
    return 'New Voucher';
  }, [isEditMode, typeCode]);

  const updateVoucherLine = (index: number, patch: Partial<AccountingVoucherLine>) => {
    setVoucherForm((prev) => ({
      ...prev,
      lines: prev.lines.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    }));
  };

  const addLine = () => {
    setVoucherForm((prev) => ({
      ...prev,
      lines: [...prev.lines, emptyLine()],
    }));
  };

  const removeLine = (index: number) => {
    setVoucherForm((prev) => ({
      ...prev,
      lines: prev.lines.length > 2 ? prev.lines.filter((_, i) => i !== index) : prev.lines,
    }));
  };

  return (
    <AccountsPageShell page="voucher-new" message={message} error={error} showQuickActions>
      <AccountsPanel title={pageTitle} icon={Receipt}>
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <select
              className="rounded-md border bg-background px-3 py-2 text-sm"
              value={voucherForm.voucherTypeId}
              onChange={(e) => setVoucherForm((p) => ({ ...p, voucherTypeId: e.target.value }))}
            >
              <option value="">Voucher type</option>
              {(voucherTypesQ.data ?? []).map((vt) => (
                <option key={vt.id} value={vt.id}>
                  {vt.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              className="rounded-md border bg-background px-3 py-2 text-sm"
              value={voucherForm.voucherDate}
              onChange={(e) => setVoucherForm((p) => ({ ...p, voucherDate: e.target.value }))}
            />
            <input
              className="rounded-md border bg-background px-3 py-2 text-sm md:col-span-2"
              placeholder="Narration"
              value={voucherForm.narration}
              onChange={(e) => setVoucherForm((p) => ({ ...p, narration: e.target.value }))}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Voucher lines</p>
              <Button type="button" size="sm" variant="outline" onClick={addLine}>
                <Plus className="mr-1 h-4 w-4" /> Add line
              </Button>
            </div>
            {voucherForm.lines.map((line, index) => (
              <div key={index} className="grid gap-2 md:grid-cols-[2fr_1fr_1fr_auto]">
                <select
                  className="rounded-md border bg-background px-3 py-2 text-sm"
                  value={line.ledgerAccountId}
                  onChange={(e) => updateVoucherLine(index, { ledgerAccountId: e.target.value })}
                >
                  <option value="">Ledger account</option>
                  {(ledgersQ.data?.items ?? []).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.code})
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-md border bg-background px-3 py-2 text-sm"
                  value={line.entryType}
                  onChange={(e) =>
                    updateVoucherLine(index, {
                      entryType: e.target.value as 'DEBIT' | 'CREDIT',
                    })
                  }
                >
                  <option value="DEBIT">Debit</option>
                  <option value="CREDIT">Credit</option>
                </select>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="rounded-md border bg-background px-3 py-2 text-sm"
                  value={line.amount || ''}
                  onChange={(e) => updateVoucherLine(index, { amount: Number(e.target.value) })}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={voucherForm.lines.length <= 2}
                  onClick={() => removeLine(index)}
                >
                  <Minus className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <p>
              Debit {formatInr(voucherDebit)} · Credit {formatInr(voucherCredit)}{' '}
              {Math.abs(voucherDebit - voucherCredit) < 0.01 ? (
                <span className="text-emerald-600">Balanced</span>
              ) : (
                <span className="text-rose-600">Unbalanced</span>
              )}
            </p>
            <Button
              disabled={
                createVoucherM.isPending ||
                updateVoucherM.isPending ||
                (isEditMode && voucherQ.isLoading) ||
                !voucherForm.voucherTypeId
              }
              onClick={() =>
                isEditMode ? updateVoucherM.mutate(voucherForm) : createVoucherM.mutate(voucherForm)
              }
            >
              {createVoucherM.isPending || updateVoucherM.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isEditMode ? (
                'Update Draft Voucher'
              ) : (
                'Save Draft Voucher'
              )}
            </Button>
          </div>
        </div>
      </AccountsPanel>
    </AccountsPageShell>
  );
}
