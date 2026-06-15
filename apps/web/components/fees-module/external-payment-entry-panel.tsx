'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CreditCard, Loader2, Search, Upload } from 'lucide-react';
import {
  approveExternalPayment,
  fetchExternalPaymentSources,
  fetchExternalPayments,
  fetchStudentFeeAccount,
  rejectExternalPayment,
  submitExternalPayment,
  uploadExternalPaymentAttachment,
} from '@/services/fee-cycle';
import { fetchStudent, fetchStudents } from '@/services/students';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import type { ExternalFeePayment, StudentFeeAccount } from '@/types/fee-cycle';
import type { StudentDirectoryRow } from '@/types/students';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { apiErrorMessage } from '@/utils/api-error';

function formatInr(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

export function ExternalPaymentEntryPanel() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const presetStudentId = searchParams.get('studentId') ?? '';
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [scanMode, setScanMode] = useState(false);
  const debouncedQuery = useDebouncedValue(query, 300);
  const [studentId, setStudentId] = useState('');
  const [paymentSource, setPaymentSource] = useState('SBI_ICOLLECT');
  const [externalReference, setExternalReference] = useState('');
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [selectedDemandIds, setSelectedDemandIds] = useState<Set<string>>(new Set());
  const [approveImmediately, setApproveImmediately] = useState(true);
  const [message, setMessage] = useState('');

  const sourcesQ = useQuery({
    queryKey: ['external-payment-sources'],
    queryFn: fetchExternalPaymentSources,
  });
  const pendingQ = useQuery({
    queryKey: ['external-payments', 'PENDING'],
    queryFn: () => fetchExternalPayments({ status: 'PENDING', limit: 50 }),
  });
  const accountQ = useQuery({
    queryKey: ['fee-account', studentId],
    queryFn: () => fetchStudentFeeAccount(studentId),
    enabled: Boolean(studentId),
  });

  const typeaheadQ = useQuery({
    queryKey: ['external-payment-student-typeahead', debouncedQuery],
    queryFn: async () => {
      const res = await fetchStudents({ search: debouncedQuery.trim(), limit: 8 });
      return res.data;
    },
    enabled: debouncedQuery.trim().length >= 2,
    staleTime: 30_000,
  });

  const suggestions = typeaheadQ.data ?? [];
  const showSuggestions =
    searchFocused &&
    debouncedQuery.trim().length >= 2 &&
    (typeaheadQ.isFetching || typeaheadQ.isFetched);

  useEffect(() => {
    if (!presetStudentId || studentId) return;
    setStudentId(presetStudentId);
    void fetchStudent(presetStudentId).then((row) => {
      setQuery(row.enrollmentNumber);
    });
  }, [presetStudentId, studentId]);

  function selectStudent(row: StudentDirectoryRow) {
    setStudentId(row.id);
    setQuery(row.enrollmentNumber || row.rollNumber || row.fullName);
    setSearchFocused(false);
    setScanMode(false);
    setMessage('');
  }

  async function runExplicitSearch() {
    const q = query.trim();
    if (!q) return;
    let rows = debouncedQuery.trim() === q ? suggestions : [];
    if (!rows.length) {
      const res = await fetchStudents({ search: q, limit: 8 });
      rows = res.data;
    }
    if (rows.length === 1) {
      selectStudent(rows[0]);
    } else if (!rows.length) {
      setMessage('No student found. Try enrollment no, roll no, name, mobile, Aadhaar, or RFID.');
      setStudentId('');
    } else {
      setSearchFocused(true);
      setMessage('');
    }
  }

  useEffect(() => {
    const q = debouncedQuery.trim();
    if (!q || q.length < 2 || !searchFocused) return;
    if (suggestions.length !== 1) return;
    const row = suggestions[0];
    const normalized = q.toLowerCase();
    const exact =
      row.enrollmentNumber?.toLowerCase() === normalized ||
      row.rollNumber?.toLowerCase() === normalized ||
      row.rfidNumber?.toLowerCase() === normalized ||
      row.applicationNumber?.toLowerCase() === normalized ||
      row.admissionNumber?.toLowerCase() === normalized;
    if (exact) selectStudent(row);
  }, [debouncedQuery, suggestions, searchFocused]);

  const account = accountQ.data;
  const payables = account?.payableItems ?? [];

  useEffect(() => {
    if (!payables.length) {
      setSelectedDemandIds(new Set());
      return;
    }
    setSelectedDemandIds(new Set(payables.map((p) => p.demandId)));
    const total = payables.reduce((s, p) => s + p.amount, 0);
    setAmount(String(total));
  }, [studentId, payables.map((p) => p.id).join(',')]);

  const selectedTotal = useMemo(
    () =>
      payables.filter((p) => selectedDemandIds.has(p.demandId)).reduce((s, p) => s + p.amount, 0),
    [payables, selectedDemandIds],
  );

  const submitMut = useMutation({
    mutationFn: () =>
      submitExternalPayment({
        studentId,
        paymentSource,
        externalReference: externalReference.trim() || undefined,
        transactionDate,
        amount: Number(amount) || selectedTotal,
        demandIds: [...selectedDemandIds],
        remarks: remarks.trim() || undefined,
        attachmentUrls: attachments,
        approveImmediately,
      }),
    onSuccess: () => {
      setMessage(
        approveImmediately ? 'Payment recorded and ledger updated.' : 'Submitted for verification.',
      );
      void qc.invalidateQueries({ queryKey: ['external-payments'] });
      void accountQ.refetch();
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Could not save payment')),
  });

  const approveMut = useMutation({
    mutationFn: approveExternalPayment,
    onSuccess: () => {
      void pendingQ.refetch();
      setMessage('Payment approved.');
    },
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      rejectExternalPayment(id, reason),
    onSuccess: () => void pendingQ.refetch(),
  });

  const uploadMut = useMutation({
    mutationFn: uploadExternalPaymentAttachment,
    onSuccess: (res) => setAttachments((prev) => [...prev, res.url || res.key]),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">External Payment Entry</h1>
        <p className="text-sm text-muted-foreground">
          Record SBI iCollect, bank transfer, college QR, scholarship, and other offline payments.
          Upload fee book or bank proof, then approve to update the student ledger immediately.
        </p>
      </div>

      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader>
            <CardTitle className="text-base">Record payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Student</Label>
              <p className="text-xs text-muted-foreground">
                Type to search — enrollment no · roll no · name · mobile · Aadhaar · RFID / barcode
              </p>
              <div className="flex flex-wrap gap-2">
                <div className="relative min-w-[240px] flex-1">
                  <Input
                    ref={searchRef}
                    className="pr-9"
                    placeholder="Name, enrollment, application, mobile, RFID…"
                    value={query}
                    autoComplete="off"
                    autoFocus={scanMode}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setSearchFocused(true);
                      if (message.includes('No student')) setMessage('');
                    }}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => window.setTimeout(() => setSearchFocused(false), 180)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && query.trim()) void runExplicitSearch();
                      if (e.key === 'Escape') setSearchFocused(false);
                    }}
                  />
                  {typeaheadQ.isFetching && debouncedQuery.trim().length >= 2 ? (
                    <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                  ) : null}

                  {showSuggestions ? (
                    <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-auto rounded-xl border border-border bg-card shadow-lg">
                      {typeaheadQ.isFetching && !suggestions.length ? (
                        <p className="px-3 py-3 text-sm text-muted-foreground">Searching…</p>
                      ) : suggestions.length ? (
                        <>
                          <p className="sticky top-0 border-b bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
                            {suggestions.length} student{suggestions.length === 1 ? '' : 's'} found
                          </p>
                          {suggestions.map((row) => (
                            <button
                              key={row.id}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => selectStudent(row)}
                              className="flex w-full items-center justify-between gap-3 border-b border-border/50 px-3 py-2.5 text-left text-sm last:border-0 hover:bg-muted/70"
                            >
                              <span>
                                <strong>{row.fullName}</strong>
                                <span className="mt-0.5 block text-xs text-muted-foreground">
                                  {row.enrollmentNumber}
                                  {row.rollNumber ? ` · Roll ${row.rollNumber}` : ''}
                                  {row.rfidNumber ? ` · RFID ${row.rfidNumber}` : ''}
                                </span>
                              </span>
                              <span className="shrink-0 text-right text-xs text-muted-foreground">
                                {row.programme ?? '—'}
                              </span>
                            </button>
                          ))}
                        </>
                      ) : (
                        <p className="px-3 py-3 text-sm text-muted-foreground">
                          No students match &ldquo;{debouncedQuery.trim()}&rdquo;
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
                <Button
                  variant="outline"
                  disabled={!query.trim() || typeaheadQ.isFetching}
                  onClick={() => void runExplicitSearch()}
                >
                  <Search className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setScanMode(true);
                    searchRef.current?.focus();
                    setMessage('Scan mode — scan ID card or RFID barcode, then press Enter.');
                  }}
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Scan ID
                </Button>
              </div>
            </div>

            {account ? <StudentFeeMiniCard account={account} /> : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Payment source</Label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={paymentSource}
                  onChange={(e) => setPaymentSource(e.target.value)}
                >
                  {(sourcesQ.data ?? []).map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Transaction number</Label>
                <Input
                  value={externalReference}
                  onChange={(e) => setExternalReference(e.target.value)}
                  placeholder="SBI ref / UTR / receipt no"
                />
              </div>
              <div className="space-y-2">
                <Label>Transaction date</Label>
                <Input
                  type="date"
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Amount (₹)</Label>
                <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Remarks</Label>
              <Input
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Fee book page, counter, notes…"
              />
            </div>

            {payables.length ? (
              <div className="space-y-2 rounded-lg border p-3">
                <Label>Allocate to fee demands</Label>
                {payables.map((item) => (
                  <label key={item.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedDemandIds.has(item.demandId)}
                      onChange={() =>
                        setSelectedDemandIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(item.demandId)) next.delete(item.demandId);
                          else next.add(item.demandId);
                          return next;
                        })
                      }
                    />
                    <span className="flex-1">{item.label}</span>
                    <span className="font-semibold">{formatInr(item.amount)}</span>
                  </label>
                ))}
                <p className="text-xs text-muted-foreground">
                  Selected total: {formatInr(selectedTotal)}
                </p>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>Attachment (fee book, receipt, screenshot, PDF)</Label>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground hover:bg-muted/50">
                <Upload className="h-4 w-4" />
                {uploadMut.isPending ? 'Uploading…' : 'Upload proof'}
                <input
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadMut.mutate(file);
                  }}
                />
              </label>
              {attachments.length ? (
                <ul className="text-xs text-muted-foreground">
                  {attachments.map((url) => (
                    <li key={url}>{url}</li>
                  ))}
                </ul>
              ) : null}
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={approveImmediately}
                onChange={(e) => setApproveImmediately(e.target.checked)}
              />
              Approve immediately and update ledger (recommended at fee counter)
            </label>

            <Button
              disabled={
                !studentId || submitMut.isPending || (!Number(amount) && selectedTotal <= 0)
              }
              onClick={() => submitMut.mutate()}
            >
              {submitMut.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              {approveImmediately ? 'Record & approve payment' : 'Submit for verification'}
            </Button>
          </CardContent>
        </Card>

        <Card className="xl:col-span-5">
          <CardHeader>
            <CardTitle className="text-base">Pending verification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingQ.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (pendingQ.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments awaiting verification.</p>
            ) : (
              (pendingQ.data ?? []).map((row) => (
                <PendingRow
                  key={row.id}
                  row={row}
                  onApprove={() => approveMut.mutate(row.id)}
                  onReject={(reason) => rejectMut.mutate({ id: row.id, reason })}
                  busy={approveMut.isPending || rejectMut.isPending}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StudentFeeMiniCard({ account }: { account: StudentFeeAccount }) {
  const s = account.student;
  return (
    <div className="rounded-lg border bg-muted/30 p-4 text-sm">
      <p className="font-semibold">{s?.name}</p>
      <p className="text-muted-foreground">
        {s?.enrollmentNumber} · {s?.program} · Sem {s?.semester ?? '—'} · {s?.shift ?? '—'}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div>
          <p className="text-xs text-muted-foreground">Admission fee</p>
          <Badge variant="secondary">{account.admissionFeeStatus?.status ?? '—'}</Badge>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Monthly fee</p>
          <Badge variant="secondary">{account.monthlyFeeStatus?.status ?? '—'}</Badge>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Outstanding</p>
          <p className="font-bold text-rose-700">{formatInr(account.summary.outstanding)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Paid months</p>
          <p>
            {account.monthlyTracker?.paidMonths ?? 0} / pending{' '}
            {account.monthlyTracker?.pendingMonths ?? 0}
          </p>
        </div>
      </div>
    </div>
  );
}

function PendingRow({
  row,
  onApprove,
  onReject,
  busy,
}: {
  row: ExternalFeePayment;
  onApprove: () => void;
  onReject: (reason: string) => void;
  busy: boolean;
}) {
  return (
    <div className="rounded-lg border p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{row.student?.name ?? row.studentId}</p>
          <p className="text-xs text-muted-foreground">
            {row.paymentSourceLabel ?? row.paymentSource} · {row.entryNo}
          </p>
        </div>
        <p className="font-bold">{formatInr(row.amount)}</p>
      </div>
      {row.externalReference ? <p className="mt-1 text-xs">Ref: {row.externalReference}</p> : null}
      <div className="mt-2 flex gap-2">
        <Button size="sm" disabled={busy} onClick={onApprove}>
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => {
            const reason = window.prompt('Rejection reason?');
            if (reason?.trim()) onReject(reason.trim());
          }}
        >
          Reject
        </Button>
      </div>
    </div>
  );
}
