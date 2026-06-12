'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Briefcase,
  CheckCircle2,
  Download,
  Eye,
  FileDown,
  Fingerprint,
  Loader2,
  Printer,
  QrCode,
  Search,
  Users,
} from 'lucide-react';

import {
  formatBulkGenerateMessage,
  staffBulkScopeLabel,
} from '@/components/id-cards/id-card-bulk-utils';
import {
  exportStaffIdCardsBulkPdf,
  MAX_STAFF_BULK_PDF,
  staffBulkPdfFilename,
  type StaffBulkPdfExportProgress,
} from '@/components/id-cards/export-staff-id-cards-bulk-pdf';

import {
  ProductionCardPreview,
  type ProductionViewMode,
} from '@/components/id-cards/production-card-preview';
import {
  buildCr80PrintDocument,
  buildCr80PrintHtmlDocument,
} from '@/components/id-cards/build-cr80-print-html';
import {
  buildStaffIdCardModelFromProfile,
  staffHolderTypeForGenerate,
} from '@/components/id-cards/build-staff-id-card-model-from-profile';
import { enhanceStaffCardModel } from '@/components/id-cards/enhance-staff-card-model';
import { pickDefaultTemplate } from '@/components/id-cards/id-card-template-utils';
import { normalizeIdCardLayout } from '@/components/id-cards/layout-legacy-migrate';
import { resolveInstitutionSignatureUrl } from '@/components/id-cards/resolve-institution-signature-url';
import { openCr80PrintPreview } from '@/components/id-cards/print-cr80-id-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useInstitutionBranding } from '@/hooks/use-institution-branding';
import { resolveUploadAssetUrl } from '@/lib/branding-asset';
import {
  bulkGenerateIdCards,
  fetchIdCardDashboard,
  fetchIdCardIssues,
  fetchIdCardPrintRequests,
  fetchIdCardTemplates,
  fetchIdCardSettings,
  generateIdCard,
  renderIdCardPdf,
  verifyIdCardPublic,
} from '@/services/id-cards';
import { fetchAcademicDepartments } from '@/services/organization';
import {
  fetchDesignations,
  fetchEnhancedStaffSummary,
  fetchStaff,
  fetchStaffProfile,
} from '@/services/staff';
import {
  STAFF_STATUSES,
  STAFF_TYPES,
  type StaffDirectoryRow,
  type StaffProfile,
} from '@/types/staff';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import { downloadBlob } from '@/utils/download-blob';

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card px-4 py-3 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {sub ? <p className="mt-0.5 text-[10px] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function staffTypeLabel(type: string) {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function StaffRowCard({
  row,
  selected,
  onSelect,
}: {
  row: StaffDirectoryRow;
  selected: boolean;
  onSelect: () => void;
}) {
  const photo = row.photoUrl ? resolveUploadAssetUrl(row.photoUrl) : null;
  return (
    <div
      className={cn(
        'flex gap-3 rounded-xl border p-3 transition-colors',
        selected
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-border/60 bg-card hover:border-primary/40',
      )}
    >
      <button type="button" onClick={onSelect} className="shrink-0">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="h-12 w-12 rounded-lg border object-cover" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-lg border bg-muted text-sm font-bold text-muted-foreground">
            {row.fullName.charAt(0)}
          </div>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <button type="button" onClick={onSelect} className="w-full text-left">
          <p className="truncate text-sm font-semibold">{row.fullName}</p>
          <p className="font-mono text-[11px] text-muted-foreground">{row.employeeCode}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {[row.designation, row.department, staffTypeLabel(row.staffType)]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {row.rfidNo ? (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700 dark:text-emerald-300">
                <Fingerprint className="h-2.5 w-2.5" /> RFID
              </span>
            ) : (
              <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-medium text-amber-700 dark:text-amber-300">
                RFID pending
              </span>
            )}
          </div>
        </button>
        <Button
          type="button"
          size="sm"
          variant={selected ? 'default' : 'outline'}
          className="mt-2 h-7 w-full text-xs"
          onClick={onSelect}
        >
          <Eye className="mr-1 h-3 w-3" /> Preview
        </Button>
      </div>
    </div>
  );
}

export function StaffIdCardProductionCenter() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const { branding } = useInstitutionBranding();

  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [staffType, setStaffType] = useState('');
  const [designationId, setDesignationId] = useState('');
  const [rfidFilter, setRfidFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [viewMode, setViewMode] = useState<ProductionViewMode>('front');
  const [message, setMessage] = useState('');
  const [printing, setPrinting] = useState(false);
  const [bulkExporting, setBulkExporting] = useState(false);
  const [qrTestResult, setQrTestResult] = useState<string | null>(null);

  const dashboardQ = useQuery({
    queryKey: ['id-cards', 'dashboard'],
    queryFn: fetchIdCardDashboard,
    enabled,
  });
  const summaryQ = useQuery({
    queryKey: ['staff', 'summary', 'enhanced'],
    queryFn: fetchEnhancedStaffSummary,
    enabled,
  });
  const queueQ = useQuery({
    queryKey: ['id-cards', 'print-queue', 'PENDING'],
    queryFn: () => fetchIdCardPrintRequests('PENDING'),
    enabled,
  });
  const departmentsQ = useQuery({
    queryKey: ['departments', 'academic'],
    queryFn: () => fetchAcademicDepartments(),
    enabled,
  });
  const designationsQ = useQuery({
    queryKey: ['staff', 'designations', staffType],
    queryFn: () => fetchDesignations(staffType || undefined),
    enabled,
  });
  const templatesQ = useQuery({
    queryKey: ['id-cards', 'templates'],
    queryFn: fetchIdCardTemplates,
    enabled,
  });
  const settingsQ = useQuery({
    queryKey: ['id-cards', 'settings'],
    queryFn: fetchIdCardSettings,
    enabled,
  });

  const signatureUrl = useMemo(
    () => resolveInstitutionSignatureUrl(settingsQ.data?.institutionSignatureUrl),
    [settingsQ.data?.institutionSignatureUrl],
  );

  const staffQ = useQuery({
    queryKey: [
      'id-cards',
      'production',
      'staff',
      search,
      departmentId,
      staffType,
      designationId,
      statusFilter,
    ],
    queryFn: () =>
      fetchStaff({
        limit: 30,
        search: search.trim() || undefined,
        departmentId: departmentId || undefined,
        staffType: staffType || undefined,
        designationId: designationId || undefined,
        status: statusFilter || undefined,
      }),
    enabled: enabled && search.trim().length >= 2,
  });

  const staffRows = useMemo(() => {
    const rows = staffQ.data?.data ?? [];
    if (rfidFilter === 'true') return rows.filter((r) => Boolean(r.rfidNo));
    if (rfidFilter === 'false') return rows.filter((r) => !r.rfidNo);
    return rows;
  }, [staffQ.data, rfidFilter]);

  const profileQ = useQuery({
    queryKey: ['staff', selectedStaffId, 'profile'],
    queryFn: () => fetchStaffProfile(selectedStaffId),
    enabled: enabled && Boolean(selectedStaffId),
  });

  const issuesQ = useQuery({
    queryKey: ['id-cards', 'issues', 'staff', selectedStaffId],
    queryFn: () => fetchIdCardIssues({ staffProfileId: selectedStaffId }),
    enabled: enabled && Boolean(selectedStaffId),
  });

  const defaultTemplate = pickDefaultTemplate(templatesQ.data, 'STAFF', 'dbc-pursuit-staff');
  const layout = useMemo(() => defaultTemplate?.layout ?? null, [defaultTemplate]);
  const normalizedLayout = useMemo(
    () => (layout ? normalizeIdCardLayout(layout, 'STAFF') : null),
    [layout],
  );

  const activeIssue = useMemo(
    () => issuesQ.data?.find((r) => ['GENERATED', 'PRINTED', 'ASSIGNED'].includes(r.status)),
    [issuesQ.data],
  );
  const cardStatus = activeIssue?.status ?? 'NOT_GENERATED';

  const generateHolderType = profileQ.data
    ? staffHolderTypeForGenerate(profileQ.data.staffType)
    : 'STAFF';

  const model = useMemo(() => {
    if (!profileQ.data) return null;
    const base = buildStaffIdCardModelFromProfile({
      profile: profileQ.data,
      branding: branding ?? undefined,
      cardNumber: activeIssue?.cardNumber ?? null,
      validityYears: settingsQ.data?.validityYears,
    });
    return enhanceStaffCardModel(base, {
      activeIssue,
      settings: settingsQ.data ?? null,
    });
  }, [profileQ.data, branding, activeIssue, settingsQ.data]);

  const selectStaff = useCallback((id: string) => {
    setSelectedStaffId(id);
    setQrTestResult(null);
  }, []);

  const runPrintPreview = async () => {
    if (!model || !normalizedLayout) return;
    setPrinting(true);
    try {
      await openCr80PrintPreview({
        model,
        layout: normalizedLayout,
        holderType: generateHolderType,
        purpose: 'preview',
        signatureUrl,
      });
    } finally {
      setPrinting(false);
    }
  };

  const runDownloadPdf = async () => {
    if (!model || !normalizedLayout) return;
    setPrinting(true);
    try {
      const { frontHtml, backHtml } = buildCr80PrintDocument({
        model,
        layout: normalizedLayout,
        purpose: 'preview',
        signatureUrl,
      });
      const html = buildCr80PrintHtmlDocument(frontHtml, backHtml);
      const blob = await renderIdCardPdf(html);
      downloadBlob(blob, `${model.holder.employeeId.replace(/\s+/g, '-')}-id-card.pdf`);
    } catch (e) {
      setMessage(apiErrorMessage(e, 'PDF generation failed'));
    } finally {
      setPrinting(false);
    }
  };

  const generateMut = useMutation({
    mutationFn: () =>
      generateIdCard({
        holderType: generateHolderType,
        staffProfileId: selectedStaffId,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['id-cards'] });
      setMessage('Card record generated.');
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Generation failed')),
  });

  const bulkMut = useMutation({
    mutationFn: (payload: Parameters<typeof bulkGenerateIdCards>[0]) =>
      bulkGenerateIdCards(payload),
    onSuccess: (res) => {
      setMessage(formatBulkGenerateMessage(res, 'staff'));
      void qc.invalidateQueries({ queryKey: ['id-cards'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Bulk operation failed')),
  });

  const runBulkGenerate = () => {
    const departmentName = departmentId
      ? (departmentsQ.data ?? []).find((dep) => dep.id === departmentId)?.name
      : undefined;
    const scope = staffBulkScopeLabel({
      departmentName,
      staffTypeLabel: staffType ? staffTypeLabel(staffType) : undefined,
    });
    const confirmed = window.confirm(
      `Generate ID card records for ${scope}?\n\nStaff who already have an active card (Generated, Printed, or Assigned) will be skipped. Up to 2,000 staff per run.`,
    );
    if (!confirmed) return;
    bulkMut.mutate({
      holderType: 'STAFF',
      departmentId: departmentId || undefined,
      staffType: staffType || undefined,
    });
  };

  const runBulkPdfExport = async () => {
    if (!normalizedLayout) return;
    const departmentName = departmentId
      ? (departmentsQ.data ?? []).find((dep) => dep.id === departmentId)?.name
      : undefined;
    const scope = staffBulkScopeLabel({
      departmentName,
      staffTypeLabel: staffType ? staffTypeLabel(staffType) : undefined,
    });
    const confirmed = window.confirm(
      `Export a single PDF with front + back pages for ${scope} who already have generated card records?\n\nUp to ${MAX_STAFF_BULK_PDF} staff per file. Run bulk generate first for staff without cards.`,
    );
    if (!confirmed) return;

    setBulkExporting(true);
    setMessage('Preparing bulk PDF export…');
    try {
      const result = await exportStaffIdCardsBulkPdf({
        layout: normalizedLayout,
        branding: branding ?? undefined,
        settings: settingsQ.data ?? null,
        signatureUrl,
        filters: {
          departmentId: departmentId || undefined,
          staffType: staffType || undefined,
          designationId: designationId || undefined,
          status: statusFilter || 'ACTIVE',
        },
        onProgress: (progress: StaffBulkPdfExportProgress) => {
          if (progress.phase === 'loading') {
            setMessage('Loading staff and card records…');
          } else if (progress.phase === 'building') {
            setMessage(`Building card pages ${progress.done}/${progress.total}…`);
          } else {
            setMessage('Rendering PDF (this may take a minute)…');
          }
        },
      });
      downloadBlob(result.blob, staffBulkPdfFilename(departmentName));
      const parts = [`Exported ${result.exported} staff (${result.exported * 2} pages).`];
      if (result.skipped > 0) parts.push(`${result.skipped} staff skipped (no card record).`);
      if (result.capped)
        parts.push(
          `Limited to ${MAX_STAFF_BULK_PDF} staff — narrow filters to export more batches.`,
        );
      setMessage(parts.join(' '));
    } catch (e) {
      setMessage(apiErrorMessage(e, 'Bulk PDF export failed'));
    } finally {
      setBulkExporting(false);
    }
  };

  const testQr = async () => {
    const code = activeIssue?.cardNumber ?? model?.verification.qrPayload ?? '';
    if (!code) {
      setQrTestResult('No QR payload — generate a card first.');
      return;
    }
    const res = await verifyIdCardPublic(code);
    setQrTestResult(
      res.valid ? `Valid — ${res.display?.name ?? code}` : (res.message ?? 'Verification failed'),
    );
  };

  const d = dashboardQ.data;
  const pendingQueue = queueQ.data?.filter((r) => r.staffProfileId).length ?? 0;

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Staff Production Center</h2>
        <p className="text-sm text-muted-foreground">
          Generate, preview, print and manage staff identity cards.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Staff" value={summaryQ.data?.total ?? '—'} sub="Active directory" />
        <StatCard label="Printed" value={d?.staffCards.printed ?? '—'} />
        <StatCard label="Pending" value={d?.staffCards.pending ?? pendingQueue} sub="Print queue" />
        <StatCard label="RFID assigned" value={d?.rfid.staffMapped ?? d?.rfid.mapped ?? '—'} />
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(280px,340px)_1fr_minmax(240px,280px)]">
        <div className="flex min-h-[520px] flex-col gap-3 overflow-hidden rounded-xl border border-border/60 bg-card/50">
          <div className="space-y-2 border-b border-border/60 p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Name, employee code, RFID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <select
                className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
              >
                <option value="">Department</option>
                {(departmentsQ.data ?? []).map((dep) => (
                  <option key={dep.id} value={dep.id}>
                    {dep.name}
                  </option>
                ))}
              </select>
              <select
                className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                value={staffType}
                onChange={(e) => {
                  setStaffType(e.target.value);
                  setDesignationId('');
                }}
              >
                <option value="">Staff type</option>
                {STAFF_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {staffTypeLabel(type)}
                  </option>
                ))}
              </select>
              <select
                className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                value={designationId}
                onChange={(e) => setDesignationId(e.target.value)}
              >
                <option value="">Designation</option>
                {(designationsQ.data ?? []).map((des) => (
                  <option key={des.id} value={des.id}>
                    {des.label}
                  </option>
                ))}
              </select>
              <select
                className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                value={rfidFilter}
                onChange={(e) => setRfidFilter(e.target.value)}
              >
                <option value="">RFID status</option>
                <option value="true">Assigned</option>
                <option value="false">Pending</option>
              </select>
              <select
                className="col-span-2 rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">Employment status</option>
                {STAFF_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {staffTypeLabel(status)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto p-3 pt-0">
            {search.trim().length < 2 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                Type at least 2 characters to search staff.
              </p>
            ) : staffQ.isLoading ? (
              <p className="py-8 text-center text-xs text-muted-foreground">Searching…</p>
            ) : staffRows.length ? (
              staffRows.map((row) => (
                <StaffRowCard
                  key={row.id}
                  row={row}
                  selected={selectedStaffId === row.id}
                  onSelect={() => selectStaff(row.id)}
                />
              ))
            ) : (
              <p className="py-8 text-center text-xs text-muted-foreground">No staff found.</p>
            )}
          </div>
        </div>

        <div className="flex min-h-[520px] flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-2">
            <div className="flex gap-1">
              {(['front', 'back', 'dual'] as const).map((mode) => (
                <Button
                  key={mode}
                  type="button"
                  size="sm"
                  variant={viewMode === mode ? 'default' : 'outline'}
                  className="h-8 capitalize"
                  onClick={() => setViewMode(mode)}
                >
                  {mode === 'dual' ? 'Dual view' : mode}
                </Button>
              ))}
            </div>
            {profileQ.data ? (
              <p className="truncate text-sm font-medium">{profileQ.data.fullName}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Select a staff member to preview</p>
            )}
          </div>

          {model && normalizedLayout ? (
            <ProductionCardPreview
              model={model}
              layout={normalizedLayout}
              holderType={generateHolderType}
              viewMode={viewMode}
              signatureUrl={signatureUrl}
            />
          ) : profileQ.isLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
              <Briefcase className="h-12 w-12 opacity-30" />
              <p className="text-sm">
                Search and select a staff member to inspect their ID card at full size.
              </p>
            </div>
          )}
        </div>

        <div className="flex min-h-[520px] flex-col gap-3 overflow-y-auto">
          {profileQ.data ? (
            <StaffInfoSidebar
              profile={profileQ.data}
              templateName={defaultTemplate?.name}
              cardStatus={cardStatus}
              issue={activeIssue}
              qrTestResult={qrTestResult}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
              Staff details appear here when selected.
            </div>
          )}

          <div className="rounded-xl border border-border/60 bg-card p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Print queue
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-muted/50 py-2">
                <p className="text-lg font-bold tabular-nums">{pendingQueue}</p>
                <p className="text-[10px] text-muted-foreground">Ready</p>
              </div>
              <div className="rounded-lg bg-muted/50 py-2">
                <p className="text-lg font-bold tabular-nums">{printing ? 1 : 0}</p>
                <p className="text-[10px] text-muted-foreground">Printing</p>
              </div>
              <div className="rounded-lg bg-muted/50 py-2">
                <p className="text-lg font-bold tabular-nums">0</p>
                <p className="text-[10px] text-muted-foreground">Failed</p>
              </div>
            </div>
            <Button asChild variant="ghost" size="sm" className="mt-1 h-auto p-0 text-xs">
              <Link href="/admin/id-cards/print-queue">Open full queue</Link>
            </Button>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-3 text-xs">
            <p className="font-semibold">Evolis Primacy</p>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              <li className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Printer online
              </li>
              <li>Ribbon: YMCKO · CR80 portrait · Dual-side</li>
              <li>Resolution: 300 DPI · Actual-size PDF</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 rounded-xl border border-border/60 bg-card/95 p-3 shadow-lg backdrop-blur">
        {message ? <p className="mb-2 text-xs text-muted-foreground">{message}</p> : null}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={!model || !normalizedLayout || printing}
            onClick={() => void runPrintPreview()}
          >
            {printing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Printer className="mr-2 h-4 w-4" />
            )}
            Print Preview
          </Button>
          <Button
            variant="secondary"
            disabled={!model || !normalizedLayout || printing}
            onClick={() => void runDownloadPdf()}
          >
            <Download className="mr-2 h-4 w-4" /> Download PDF
          </Button>
          <Button
            variant="outline"
            disabled={!selectedStaffId || generateMut.isPending}
            onClick={() => generateMut.mutate()}
          >
            Generate record
          </Button>
          <Button variant="outline" disabled={!model} onClick={() => void testQr()}>
            <QrCode className="mr-2 h-4 w-4" /> Test QR
          </Button>
          <span className="mx-1 hidden h-6 w-px bg-border sm:block" />
          <Button
            variant="outline"
            size="sm"
            disabled={bulkMut.isPending}
            onClick={runBulkGenerate}
          >
            {bulkMut.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Users className="mr-2 h-4 w-4" />
            )}
            Bulk generate{departmentId || staffType ? ' (filtered)' : ' all staff'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={!normalizedLayout || bulkExporting || printing}
            onClick={() => void runBulkPdfExport()}
          >
            {bulkExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="mr-2 h-4 w-4" />
            )}
            Bulk export PDF
          </Button>
          <Button asChild variant="ghost" size="sm" className="ml-auto">
            <Link href="/admin/id-cards/templates">Edit template</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function StaffInfoSidebar({
  profile,
  templateName,
  cardStatus,
  issue,
  qrTestResult,
}: {
  profile: StaffProfile;
  templateName?: string;
  cardStatus: string;
  issue?: { cardNumber: string; status: string; createdAt: string; printedAt?: string | null };
  qrTestResult: string | null;
}) {
  const photo = profile.photoUrl ? resolveUploadAssetUrl(profile.photoUrl) : null;

  const statusColors: Record<string, string> = {
    GENERATED: 'bg-blue-500/10 text-blue-700',
    PRINTED: 'bg-emerald-500/10 text-emerald-700',
    ASSIGNED: 'bg-violet-500/10 text-violet-700',
    LOST: 'bg-red-500/10 text-red-700',
    DISABLED: 'bg-slate-500/10 text-slate-600',
    NOT_GENERATED: 'bg-amber-500/10 text-amber-700',
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border/60 bg-card p-3">
        <div className="flex gap-3">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="h-16 w-16 rounded-lg border object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-lg border bg-muted font-bold">
              {profile.fullName.charAt(0)}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold leading-tight">{profile.fullName}</p>
            <p className="font-mono text-[11px] text-muted-foreground">{profile.employeeCode}</p>
            <p className="text-[11px] text-muted-foreground">
              {profile.designation ?? profile.department ?? '—'}
            </p>
          </div>
        </div>
        <dl className="mt-3 space-y-1.5 text-xs">
          <InfoRow label="Department" value={profile.department ?? '—'} />
          <InfoRow label="Staff type" value={staffTypeLabel(profile.staffType)} />
          <InfoRow
            label="Employment"
            value={profile.employmentType ? staffTypeLabel(profile.employmentType) : '—'}
          />
          <InfoRow label="Status" value={staffTypeLabel(profile.status)} />
          <InfoRow label="Email" value={profile.email ?? '—'} />
          <InfoRow label="Mobile" value={profile.mobile ?? '—'} />
          <InfoRow label="Blood group" value={profile.bloodGroup ?? '—'} />
          <InfoRow
            label="RFID"
            value={
              profile.rfidNo ? (
                <span className="inline-flex items-center gap-1 text-emerald-600">
                  <CheckCircle2 className="h-3 w-3" /> Assigned
                </span>
              ) : (
                'Pending'
              )
            }
          />
          <InfoRow label="Template" value={templateName ?? 'Staff default'} />
        </dl>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Card status
        </p>
        <span
          className={cn(
            'mt-2 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
            statusColors[cardStatus] ?? statusColors.NOT_GENERATED,
          )}
        >
          {cardStatus.replace(/_/g, ' ')}
        </span>
        {issue ? (
          <dl className="mt-3 space-y-1 text-[11px] text-muted-foreground">
            <InfoRow label="Card no" value={issue.cardNumber} mono />
            <InfoRow label="Generated" value={new Date(issue.createdAt).toLocaleString()} />
            {issue.printedAt ? (
              <InfoRow label="Printed" value={new Date(issue.printedAt).toLocaleString()} />
            ) : null}
          </dl>
        ) : null}
      </div>

      {qrTestResult ? (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
          {qrTestResult}
        </div>
      ) : null}
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('text-right font-medium', mono && 'font-mono text-[10px]')}>{value}</dd>
    </div>
  );
}
