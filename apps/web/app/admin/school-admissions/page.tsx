'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Eye, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { SCHOOL_CASTE_CATEGORY_POLICY } from '@/lib/school-admission-category';
import {
  downloadSchoolOfficeApplicationPdf,
  exportSchoolOfficeApplications,
  fetchSchoolOfficeApplications,
} from '@/services/school-admissions';
import { Suspense, useEffect, useState } from 'react';
import { SchoolOfficeStatusBadge } from '@/components/school-office/status-badge';
import { schoolDocumentDisplayStatus } from '@/lib/school-document-display-status';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

export default function SchoolAdmissionsOfficePage() {
  return (
    <Suspense
      fallback={<p className="text-sm text-[var(--school-erp-muted)]">Loading applications…</p>}
    >
      <SchoolAdmissionsOfficeList />
    </Suspense>
  );
}

function SchoolAdmissionsOfficeList() {
  const enabled = useAuthQueryEnabled();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  useEffect(() => {
    setCategory(searchParams.get('category') ?? '');
    setStatus(searchParams.get('status') ?? '');
    setPaymentStatus(searchParams.get('paymentStatus') ?? '');
    const q = searchParams.get('search');
    if (q) setSearch(q);
  }, [searchParams]);

  const list = useQuery({
    queryKey: ['school-office-applications', search, category, status, paymentStatus],
    queryFn: () =>
      fetchSchoolOfficeApplications({
        search: search || undefined,
        category: category || undefined,
        status: status || undefined,
        paymentStatus: paymentStatus || undefined,
        limit: 50,
      }),
    enabled,
  });

  const downloadExcel = async () => {
    const blob = await exportSchoolOfficeApplications({
      search: search || undefined,
      category: category || undefined,
      status: status || undefined,
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    link.download = `Tura_Public_School_KG_Admission_2027_Report_${d}-${m}-${y}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadPdf = async (id: string, applicationNumber: string) => {
    setPdfError(null);
    setPdfBusyId(id);
    try {
      const blob = await downloadSchoolOfficeApplicationPdf(id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${applicationNumber || 'application'}_KG_2027_Application.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setPdfError(apiErrorMessage(err));
    } finally {
      setPdfBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--school-erp-muted)]">
          Admission 2027
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--school-erp-primary)]">
          K.G. Applications
        </h1>
        <p className="mt-1 text-sm text-[var(--school-erp-muted)]">
          Browse applications. Use Fee &amp; Payments, Documents, and Admission Decisions for
          operational queues.
        </p>
        <div className="mt-2 flex flex-wrap gap-3 text-sm">
          <Link
            className="font-medium text-[var(--school-erp-primary)] underline"
            href="/admin/school-admissions/payments/pending"
          >
            Payment Verification
          </Link>
          <Link
            className="font-medium text-[var(--school-erp-primary)] underline"
            href="/admin/school-admissions/documents/pending"
          >
            Document Verification
          </Link>
          <Link
            className="font-medium text-[var(--school-erp-primary)] underline"
            href="/admin/school-admissions/decisions"
          >
            Admission Decisions
          </Link>
          <Link
            className="font-medium text-[var(--school-erp-primary)] underline"
            href="/admin/school-admissions/admission-settings"
          >
            Admission Settings
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-[var(--school-erp-border)] bg-white p-4 shadow-sm">
        <Input
          placeholder="Search name, application number, mobile"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md rounded-xl"
        />
        <select
          className="h-10 rounded-xl border border-input bg-white px-3 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="draft">In progress</option>
          <option value="submitted">Submitted</option>
          <option value="under_review">Under review</option>
          <option value="allotted">Admission granted</option>
          <option value="rejected">Not granted</option>
        </select>
        <select
          className="h-10 rounded-xl border border-input bg-white px-3 text-sm"
          value={paymentStatus}
          onChange={(e) => setPaymentStatus(e.target.value)}
        >
          <option value="">All payments</option>
          <option value="PENDING">Payment pending</option>
          <option value="PAID">Payment verified</option>
        </select>
        <select
          className="h-10 rounded-xl border border-input bg-white px-3 text-sm"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">All categories</option>
          {SCHOOL_CASTE_CATEGORY_POLICY.map((item) => (
            <option key={item.code} value={item.code}>
              {item.label}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="outline"
          className="rounded-xl"
          onClick={() => void downloadExcel()}
        >
          Download Excel Report
        </Button>
      </div>

      {pdfError ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {pdfError}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-[var(--school-erp-border)] bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-[#eaf5ee]/60 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="p-3 font-medium">Application</th>
              <th className="p-3 font-medium">Child</th>
              <th className="p-3 font-medium">Caste / Category</th>
              <th className="hidden p-3 font-medium md:table-cell">Required certificates</th>
              <th className="hidden p-3 font-medium lg:table-cell">Contact</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Payment</th>
              <th className="sticky right-0 z-10 bg-[#eaf5ee] p-3 text-right font-medium shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.12)]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {(list.data?.data ?? []).map((row) => {
              const pdfReady = Boolean(row.pdfAvailable);
              const busy = pdfBusyId === row.id;
              return (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="p-3">
                    <Link
                      className="font-mono text-xs font-semibold text-[var(--school-erp-primary)] underline"
                      href={`/admin/school-admissions/${row.id}`}
                    >
                      {row.applicationNumber}
                    </Link>
                  </td>
                  <td className="p-3">{row.childName || row.firstName}</td>
                  <td className="p-3">
                    {row.categoryLabel ?? '—'}
                    {row.community ? (
                      <div className="text-xs text-muted-foreground">{row.community}</div>
                    ) : null}
                  </td>
                  <td className="hidden p-3 text-xs md:table-cell">
                    {(row.certificateChecklist ?? []).length === 0 ? (
                      <span className="text-muted-foreground">None</span>
                    ) : (
                      <ul className="space-y-1">
                        {(row.certificateChecklist ?? []).map((item) => {
                          const display = schoolDocumentDisplayStatus({
                            uploaded: item.uploaded,
                            verificationStatus: item.verificationStatus,
                          });
                          return (
                            <li key={item.slotCode}>
                              <span className="font-medium">{item.label}</span>
                              <span
                                className={
                                  display.tone === 'success'
                                    ? ' text-emerald-700'
                                    : display.tone === 'danger'
                                      ? ' text-rose-700'
                                      : display.tone === 'warning'
                                        ? ' text-amber-800'
                                        : ' text-slate-600'
                                }
                              >
                                {' '}
                                · {display.displayLabel}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </td>
                  <td className="hidden p-3 lg:table-cell">
                    {row.phone}
                    <div className="text-xs text-muted-foreground">{row.email}</div>
                  </td>
                  <td className="p-3">
                    <SchoolOfficeStatusBadge
                      label={row.status.replaceAll('_', ' ')}
                      tone={
                        row.status === 'allotted'
                          ? 'success'
                          : row.status === 'rejected'
                            ? 'danger'
                            : row.status === 'draft'
                              ? 'neutral'
                              : 'info'
                      }
                    />
                  </td>
                  <td className="p-3">
                    <SchoolOfficeStatusBadge
                      label={row.paymentStatus === 'PAID' ? 'Verified' : row.paymentStatus}
                      tone={row.paymentStatus === 'PAID' ? 'success' : 'warning'}
                    />
                  </td>
                  <td className="sticky right-0 z-10 bg-white p-2 text-right shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.08)]">
                    <div className="inline-flex items-center justify-end gap-1">
                      <Link
                        href={`/admin/school-admissions/${row.id}`}
                        title="View Application"
                        aria-label="View Application"
                        className={cn(
                          'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--school-erp-border)]',
                          'text-[var(--school-erp-primary)] transition hover:bg-[#eaf5ee]',
                        )}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Link>
                      <button
                        type="button"
                        title={
                          pdfReady
                            ? 'Download Application PDF'
                            : 'PDF unavailable — generated after submission'
                        }
                        aria-label={pdfReady ? 'Download Application PDF' : 'PDF unavailable'}
                        disabled={!pdfReady || busy}
                        onClick={() => void downloadPdf(row.id, row.applicationNumber)}
                        className={cn(
                          'inline-flex h-8 w-8 items-center justify-center rounded-lg border transition',
                          pdfReady
                            ? 'border-[var(--school-erp-primary)] bg-[var(--school-erp-primary)] text-white hover:bg-[var(--school-erp-primary-hover)]'
                            : 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400',
                        )}
                      >
                        <FileText className={cn('h-3.5 w-3.5', busy && 'animate-pulse')} />
                      </button>
                    </div>
                    {!pdfReady ? (
                      <p className="mt-1 text-[10px] text-slate-400">PDF unavailable</p>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {list.data?.data.length === 0 ? (
          <p className="p-6 text-sm text-[var(--school-erp-muted)]">No applications yet.</p>
        ) : null}
      </div>
    </div>
  );
}
