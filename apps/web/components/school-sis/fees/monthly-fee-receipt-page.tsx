'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchMonthlyFeePayment, downloadMonthlyFeeReceiptPdf } from '@/services/school-sis';
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
  const props = {
    schoolName: String(settings.schoolName || "St. Luke's Secondary School"),
    schoolAddress: String(settings.schoolAddress || 'Walbakgre, New Tura'),
    monthLabel,
    studentName: String(snap.studentName || p.student.fullName),
    admissionNumber: String(snap.admissionNumber || p.student.admissionNumber),
    className: `${snap.className ?? ''} ${snap.sectionName ?? ''}`.trim(),
    receiptNumber: p.receiptNumber,
    academicYear: String(snap.academicYear ?? ''),
    paidAt: new Date(p.paidAt).toLocaleString('en-IN'),
    paymentMode: p.paymentMode,
    tuition: p.tuitionAmount,
    late: p.lateFeeAmount,
    other: p.otherAmount,
    discount: p.discountAmount,
    previous: p.previousBalance,
    total: p.totalAmount,
    signatory: settings.signatoryName as string | null,
    instructions,
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 print:hidden">
        <button
          type="button"
          className="rounded-xl bg-[var(--school-erp-primary)] px-4 py-2 text-sm text-white"
          onClick={() => window.print()}
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
      <div className="grid gap-4 lg:grid-cols-2">
        <MonthlyFeeReceiptCard copy="Parent's copy" {...props} />
        <MonthlyFeeReceiptCard copy="School copy" {...props} />
      </div>
    </div>
  );
}
