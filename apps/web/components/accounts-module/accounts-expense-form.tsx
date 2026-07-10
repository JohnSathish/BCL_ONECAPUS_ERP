'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AccountsPanel } from '@/components/accounts-module/accounts-ui';
import { createExpense, fetchLedgers, fetchVendors, updateExpense } from '@/services/accounting';
import type { AccountingExpense } from '@/types/accounting';
import { apiErrorMessage } from '@/utils/api-error';

type Props = {
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
  editingExpense?: AccountingExpense | null;
  onCancelEdit?: () => void;
  canManage?: boolean;
};

function createExpenseDraft() {
  return {
    vendorId: '',
    ledgerAccountId: '',
    expenseDate: new Date().toISOString().slice(0, 10),
    amount: '',
    gstAmount: '',
    billNo: '',
    description: '',
  };
}

export function AccountsExpenseForm({
  onSuccess,
  onError,
  editingExpense,
  onCancelEdit,
  canManage = true,
}: Props) {
  const qc = useQueryClient();
  const [rows, setRows] = useState([createExpenseDraft()]);
  const [savingRows, setSavingRows] = useState(false);
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!editingExpense) return;
    setRows([
      {
        vendorId: editingExpense.vendorId ?? '',
        ledgerAccountId: editingExpense.ledgerAccountId ?? editingExpense.ledgerAccount?.id ?? '',
        expenseDate:
          editingExpense.expenseDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
        amount: String(editingExpense.amount ?? ''),
        gstAmount: String(editingExpense.gstAmount ?? ''),
        billNo: editingExpense.billNo ?? '',
        description: editingExpense.description ?? '',
      },
    ]);
  }, [editingExpense]);

  const vendorsQ = useQuery({
    queryKey: ['accounting', 'vendors'],
    queryFn: () => fetchVendors({ limit: 200 }),
  });
  const ledgersQ = useQuery({
    queryKey: ['accounting', 'ledgers', 'expense-form'],
    queryFn: () => fetchLedgers({ limit: 300 }),
  });

  const duplicateRow = (index: number) => {
    setRows((prev) => {
      const copy = { ...prev[index], amount: '', gstAmount: '', billNo: '' };
      return [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)];
    });
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[index + 1];
      return next;
    });
  };

  const saveRows = async () => {
    const validationErrors: Record<number, string> = {};
    rows.forEach((r, idx) => {
      if (!r.ledgerAccountId) validationErrors[idx] = 'Select an expense ledger.';
      else if (!r.expenseDate) validationErrors[idx] = 'Select expense date.';
      else if (!(Number(r.amount) > 0)) validationErrors[idx] = 'Enter amount greater than 0.';
      else if (r.gstAmount && Number(r.gstAmount) < 0)
        validationErrors[idx] = 'GST cannot be negative.';
    });
    setRowErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      onError?.('Fix highlighted expense row errors before saving.');
      return;
    }

    const payloads = rows
      .filter((_, idx) => !validationErrors[idx])
      .map((r) => ({
        vendorId: r.vendorId || undefined,
        ledgerAccountId: r.ledgerAccountId,
        expenseDate: r.expenseDate,
        amount: Number(r.amount),
        gstAmount: r.gstAmount ? Number(r.gstAmount) : undefined,
        billNo: r.billNo || undefined,
        description: r.description || undefined,
      }));
    if (!payloads.length) {
      onError?.('Please add at least one valid expense row.');
      return;
    }
    setSavingRows(true);
    try {
      if (editingExpense) {
        await updateExpense(editingExpense.id, payloads[0]);
        onSuccess?.('Expense bill updated');
      } else {
        await Promise.all(payloads.map((p) => createExpense(p)));
        onSuccess?.(`${payloads.length} expense bill(s) recorded`);
      }
      qc.invalidateQueries({ queryKey: ['accounting', 'expenses'] });
      setRows([createExpenseDraft()]);
      onCancelEdit?.();
    } catch (err) {
      onError?.(apiErrorMessage(err));
    } finally {
      setSavingRows(false);
    }
  };

  return (
    <AccountsPanel
      title={editingExpense ? 'Edit Expense Bill' : 'Record Expense Bills'}
      icon={Receipt}
    >
      {editingExpense ? (
        <p className="text-xs font-medium text-amber-700">Editing: {editingExpense.expenseNo}</p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Tip: Press Enter to duplicate this row and Ctrl+S to save all rows.
      </p>
      <div
        className="space-y-3"
        onKeyDownCapture={(e) => {
          if (e.ctrlKey && e.key.toLowerCase() === 's') {
            e.preventDefault();
            void saveRows();
            return;
          }
          if (
            !editingExpense &&
            e.key === 'Enter' &&
            !e.shiftKey &&
            !e.ctrlKey &&
            !e.altKey &&
            !e.metaKey
          ) {
            const target = e.target as HTMLElement;
            const rowEl = target.closest('[data-expense-row-index]') as HTMLElement | null;
            const rowIndex = rowEl?.dataset.expenseRowIndex;
            if (rowIndex != null) {
              e.preventDefault();
              duplicateRow(Number(rowIndex));
            }
          }
        }}
      >
        {rows.map((row, index) => (
          <div
            key={`expense-row-${index}`}
            data-expense-row-index={index}
            className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
          >
            <select
              className={`rounded-md border bg-background px-3 py-2 text-sm ${
                rowErrors[index] && !row.ledgerAccountId
                  ? 'border-rose-500 focus-visible:ring-rose-500'
                  : ''
              }`}
              value={row.vendorId}
              onChange={(e) =>
                setRows((prev) =>
                  prev.map((item, i) =>
                    i === index ? { ...item, vendorId: e.target.value } : item,
                  ),
                )
              }
            >
              <option value="">Vendor (optional)</option>
              {(vendorsQ.data?.items ?? []).map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name} ({vendor.code})
                </option>
              ))}
            </select>
            <select
              className={`rounded-md border bg-background px-3 py-2 text-sm ${
                rowErrors[index] && !row.ledgerAccountId
                  ? 'border-rose-500 focus-visible:ring-rose-500'
                  : ''
              }`}
              value={row.ledgerAccountId}
              onChange={(e) =>
                setRows((prev) =>
                  prev.map((item, i) =>
                    i === index ? { ...item, ledgerAccountId: e.target.value } : item,
                  ),
                )
              }
            >
              <option value="">Expense ledger</option>
              {(ledgersQ.data?.items ?? []).map((ledger) => (
                <option key={ledger.id} value={ledger.id}>
                  {ledger.name} ({ledger.code})
                </option>
              ))}
            </select>
            <input
              type="date"
              className={`rounded-md border bg-background px-3 py-2 text-sm ${
                rowErrors[index] && !row.expenseDate
                  ? 'border-rose-500 focus-visible:ring-rose-500'
                  : ''
              }`}
              value={row.expenseDate}
              onChange={(e) =>
                setRows((prev) =>
                  prev.map((item, i) =>
                    i === index ? { ...item, expenseDate: e.target.value } : item,
                  ),
                )
              }
            />
            <input
              type="number"
              min="0"
              step="0.01"
              className={`rounded-md border bg-background px-3 py-2 text-sm ${
                rowErrors[index] && !(Number(row.amount) > 0)
                  ? 'border-rose-500 focus-visible:ring-rose-500'
                  : ''
              }`}
              placeholder="Amount"
              value={row.amount}
              onChange={(e) =>
                setRows((prev) =>
                  prev.map((item, i) => (i === index ? { ...item, amount: e.target.value } : item)),
                )
              }
            />
            <input
              type="number"
              min="0"
              step="0.01"
              className={`rounded-md border bg-background px-3 py-2 text-sm ${
                rowErrors[index] && row.gstAmount !== '' && Number(row.gstAmount) < 0
                  ? 'border-rose-500 focus-visible:ring-rose-500'
                  : ''
              }`}
              placeholder="GST amount"
              value={row.gstAmount}
              onChange={(e) =>
                setRows((prev) =>
                  prev.map((item, i) =>
                    i === index ? { ...item, gstAmount: e.target.value } : item,
                  ),
                )
              }
            />
            <input
              className={`rounded-md border bg-background px-3 py-2 text-sm ${
                rowErrors[index] && !(Number(row.amount) > 0)
                  ? 'border-rose-500 focus-visible:ring-rose-500'
                  : ''
              }`}
              placeholder="Bill / invoice no."
              value={row.billNo}
              onChange={(e) =>
                setRows((prev) =>
                  prev.map((item, i) => (i === index ? { ...item, billNo: e.target.value } : item)),
                )
              }
            />
            <input
              className={`rounded-md border bg-background px-3 py-2 text-sm xl:col-span-2 ${
                rowErrors[index] && !(Number(row.amount) > 0)
                  ? 'border-rose-500 focus-visible:ring-rose-500'
                  : ''
              }`}
              placeholder="Description"
              value={row.description}
              onChange={(e) =>
                setRows((prev) =>
                  prev.map((item, i) =>
                    i === index ? { ...item, description: e.target.value } : item,
                  ),
                )
              }
            />
            <div>
              <div className="flex gap-2">
                {!editingExpense ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => duplicateRow(index)}
                  >
                    Duplicate
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={rows.length <= 1 || Boolean(editingExpense)}
                  onClick={() =>
                    setRows((prev) =>
                      prev.length <= 1 ? prev : prev.filter((_, i) => i !== index),
                    )
                  }
                >
                  Remove
                </Button>
              </div>
            </div>
            {rowErrors[index] ? (
              <p className="xl:col-span-4 text-xs font-medium text-rose-600">{rowErrors[index]}</p>
            ) : null}
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          {!editingExpense && canManage ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setRows((prev) => [...prev, createExpenseDraft()])}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Row
            </Button>
          ) : null}
          {editingExpense && canManage ? (
            <Button type="button" variant="outline" onClick={onCancelEdit}>
              Cancel Edit
            </Button>
          ) : null}
          <Button disabled={savingRows || !canManage} onClick={() => void saveRows()}>
            {savingRows ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            {editingExpense ? 'Update Expense Bill' : 'Save Expense Bills'}
          </Button>
        </div>
      </div>
    </AccountsPanel>
  );
}
