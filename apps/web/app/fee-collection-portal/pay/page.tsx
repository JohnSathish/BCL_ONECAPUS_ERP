'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { runFeeGatewayCheckout } from '@/lib/fee-gateway-checkout';
import {
  initiateCenterPayment,
  searchCenterStudent,
  simulateCenterPayment,
  verifyCenterRazorpay,
  type CenterStudentDues,
} from '@/services/fee-collection-centers';
import { apiErrorMessage } from '@/utils/api-error';

function inr(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

export default function FeeCollectionPayPage() {
  const [q, setQ] = useState('');
  const [student, setStudent] = useState<CenterStudentDues | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMsg(null);
    setStudent(null);
    setSelected([]);
    try {
      const res = await searchCenterStudent(q.trim());
      setStudent(res);
      setSelected(res.payableItems.filter((i) => i.amount > 0).map((i) => i.demandId));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const payAmount = student
    ? student.payableItems
        .filter((i) => selected.includes(i.demandId))
        .reduce((sum, i) => sum + Number(i.amount || 0), 0)
    : 0;

  async function onPay() {
    if (!student || payAmount <= 0) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await initiateCenterPayment({
        studentId: student.studentId,
        amount: payAmount,
        demandIds: selected,
      });
      const checkout = res.checkout as any;
      const result = await runFeeGatewayCheckout(
        {
          ...checkout,
          returnUrl:
            checkout.returnUrl ||
            `${window.location.origin}/fee-collection-portal/pay/return?atomReturn=1&paymentId=${checkout.paymentId ?? res.payment?.id ?? ''}`,
        },
        {
          onRazorpaySuccess: async (response) => {
            await verifyCenterRazorpay(response);
          },
        },
      );

      if (result.kind === 'mock' && result.paymentId) {
        const sim = await simulateCenterPayment(result.paymentId);
        setMsg(`Payment successful — receipt ${sim.receipt?.receiptNo ?? 'issued'}.`);
        const refreshed = await searchCenterStudent(student.rollNumber || student.studentId);
        setStudent(refreshed);
        return;
      }

      if (result.kind === 'verified') {
        setMsg('Payment verified successfully.');
        const refreshed = await searchCenterStudent(student.rollNumber || student.studentId);
        setStudent(refreshed);
        return;
      }

      if (result.kind === 'atom_opened' || result.kind === 'redirected') {
        setMsg('Complete payment in the gateway window. You will return here afterwards.');
      }
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-white">Collect student fee</h2>
        <p className="text-sm text-slate-400">
          Search by roll / enrollment / admission number. Only payment-safe fields are shown.
        </p>
      </div>

      <form onSubmit={onSearch} className="flex flex-wrap items-end gap-3">
        <div className="min-w-[240px] flex-1">
          <Label className="text-slate-300">Student ID / roll / enrollment</Label>
          <Input
            className="mt-1 border-white/15 bg-black/30 text-white"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. BA25-895"
            required
            minLength={2}
          />
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? 'Searching…' : 'Search'}
        </Button>
      </form>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      {msg ? <p className="text-sm text-emerald-300">{msg}</p> : null}

      {student ? (
        <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <p>
              <span className="text-slate-400">Name:</span> {student.fullName}
            </p>
            <p>
              <span className="text-slate-400">Roll:</span> {student.rollNumber ?? '—'}
            </p>
            <p>
              <span className="text-slate-400">Programme:</span> {student.programme ?? '—'}
            </p>
            <p>
              <span className="text-slate-400">Department:</span> {student.department ?? '—'}
            </p>
            <p>
              <span className="text-slate-400">Semester:</span> {student.semester ?? '—'}
            </p>
            <p>
              <span className="text-slate-400">Pending:</span> {inr(student.pendingFee)}
            </p>
            <p>
              <span className="text-slate-400">Fine:</span> {inr(student.lateFine)}
            </p>
            <p>
              <span className="text-slate-400">Total payable:</span> {inr(student.totalPayable)}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-white">Fee heads</p>
            {student.payableItems.length === 0 ? (
              <p className="text-sm text-slate-500">No outstanding payable items.</p>
            ) : (
              student.payableItems.map((item) => (
                <label
                  key={item.demandId}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/10 px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selected.includes(item.demandId)}
                      onChange={(e) => {
                        setSelected((prev) =>
                          e.target.checked
                            ? [...prev, item.demandId]
                            : prev.filter((id) => id !== item.demandId),
                        );
                      }}
                    />
                    {item.label}
                  </span>
                  <span>{inr(item.amount)}</span>
                </label>
              ))
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-3">
            <p className="text-sm text-slate-300">
              Pay now: <strong className="text-white">{inr(payAmount)}</strong>
            </p>
            <Button type="button" disabled={busy || payAmount <= 0} onClick={onPay}>
              {busy ? 'Processing…' : 'Pay via gateway'}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
