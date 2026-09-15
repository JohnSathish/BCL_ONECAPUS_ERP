'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  fetchMonthlyFeePayment,
  downloadMonthlyFeeReceiptPdf,
  printMonthlyFeeReceipt,
} from '@/services/school-sis';
import { MonthlyFeeReceiptCard } from './monthly-fee-receipt-card';

export function MonthlyFeeReceiptPage() {
  const enabled = useAuthQueryEnabled();
  const id = String(useParams().id ?? '');
  const query = useQuery({
    queryKey: ['monthly-fee-payment', id],
    queryFn: () => fetchMonthlyFeePayment(id),
    enabled: enabled && Boolean(id),
  });
  const p = query.data;
  const snap = (p?.snapshotJson ?? {}) as Record<string, any>;
  const settings = (snap.settings ?? {}) as Record<string, any>;
  if (query.isLoading) return <p className="text-sm text-slate-500">Loading receipt…</p>;
  if (!p) return <p className="text-sm text-red-600">Receipt not found.</p>;
  const monthLabel = new Date(`${p.feeMonth}-01`).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
  const instructions: string[] = Array.isArray(settings.instructions)
    ? settings.instructions
    : [
        'Fees are to be paid before the 15th of every month.',
        'Annual Fees and Jan. & Feb. Tuition Fees to be paid at the time of Admission.',
        'Pupils with dues may be barred from sitting for the Examinations.',
        'Fees once paid are not refundable.',
      ];
  const monthsCovered = Array.isArray(snap.months)
    ? snap.months.map((m: { monthLabel?: string }) => String(m.monthLabel || ''))
    : [monthLabel];
  const amounts = (snap.amounts ?? {}) as Record<string, number>;
  const lineSum = (key: 'tuitionAmount' | 'lateFeeAmount' | 'otherAmount') =>
    (p.lines ?? []).reduce((sum, line) => sum + Number(line[key] || 0), 0);
  const snapMonths = Array.isArray(snap.months) ? snap.months : [];
  const snapSum = (key: string) =>
    snapMonths.reduce((sum: number, m: Record<string, number>) => sum + Number(m[key] || 0), 0);
  const props = {
    schoolName: String(settings.schoolName || "St. Luke's Secondary School, Tura"),
    schoolAddress: String(
      settings.schoolAddress || 'Walbakgre, Tura - 794101, West Garo Hills, Meghalaya',
    ),
    logoUrl: (settings.logoUrl as string | null) || '/school-sis/st-lukes-logo.png',
    motto: (settings.motto as string | null) || 'Knowledge · Service · Light',
    monthLabel: monthsCovered.filter(Boolean).join(', ') || monthLabel,
    studentName: String(snap.studentName || p.student.fullName),
    admissionNumber: String(snap.admissionNumber || p.student.admissionNumber),
    className: `${snap.className ?? ''} ${snap.sectionName ?? ''}`.trim(),
    receiptNumber: p.receiptNumber,
    academicYear: String(snap.academicYear ?? ''),
    paidAt: new Date(p.paidAt).toLocaleString('en-IN'),
    paymentMode: p.paymentMode,
    gatewayName: (snap.gateway as { gatewayName?: string } | undefined)?.gatewayName ?? null,
    gatewayPaymentId:
      (snap.gateway as { paymentId?: string } | undefined)?.paymentId ?? p.reference,
    tuition:
      p.tuitionAmount ||
      Number(amounts.tuition || 0) ||
      snapSum('tuitionAmount') ||
      lineSum('tuitionAmount') ||
      Math.max(
        0,
        Number(p.grossAmount || amounts.gross || 0) - (p.lateFeeAmount || 0) - (p.otherAmount || 0),
      ),
    late:
      p.lateFeeAmount ||
      Number(amounts.late || 0) ||
      snapSum('lateFeeAmount') ||
      lineSum('lateFeeAmount'),
    other:
      p.otherAmount ||
      Number(amounts.other || 0) ||
      snapSum('otherAmount') ||
      lineSum('otherAmount'),
    otherLabel: String(snap.otherLabel || 'Other Fee'),
    discount:
      p.discountAmount ||
      Number(amounts.concession || 0) ||
      Number((snap.concession as { amount?: number } | undefined)?.amount || 0),
    previous: p.previousBalance,
    total: p.totalAmount || Number(amounts.cash || snap.cashCollected || 0),
    signatory: settings.signatoryName as string | null,
    instructions,
    monthsCovered: monthsCovered.filter(Boolean),
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 print:hidden">
        <button
          type="button"
          className="rounded-xl bg-[var(--school-erp-primary)] px-4 py-2 text-sm text-white"
          onClick={() => void printMonthlyFeeReceipt(p.id)}
        >
          Print parent & school copies
        </button>
        <button
          type="button"
          className="rounded-xl border bg-white px-4 py-2 text-sm"
          onClick={() => void downloadMonthlyFeeReceiptPdf(p.id, p.receiptNumber)}
        >
          Download PDF
        </button>
        <p className="self-center text-sm text-slate-500">
          {p.status === 'VOIDED' ? 'VOIDED — kept for audit' : p.receiptNumber}
        </p>
      </div>
      <div className="grid gap-4 bg-[#eef2f7] p-2 print:bg-white lg:grid-cols-2">
        <MonthlyFeeReceiptCard copy="Parent's Copy" {...props} />
        <MonthlyFeeReceiptCard copy="School Copy" {...props} />
      </div>
    </div>
  );
}
