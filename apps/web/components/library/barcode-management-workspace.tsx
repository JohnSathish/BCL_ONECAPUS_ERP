'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Barcode,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Eye,
  Printer,
  Search,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  libraryFilterControlClass,
  libraryFilterLabelClass,
  librarySearchButtonClass,
  librarySearchInputClass,
  librarySearchPanelClass,
} from '@/components/library/library-search-panel';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchAcademicDepartments } from '@/services/organization';
import {
  alignBarcodeCopies,
  createBarcodeJob,
  downloadBarcodeReport,
  fetchBarcodeCopies,
  fetchBarcodeCopyIds,
  fetchBarcodeJobs,
  fetchBarcodeReports,
  fetchBarcodeSettings,
  fetchBarcodeSummary,
  fetchLibraryCategories,
  previewBarcodeLabels,
  saveBarcodeSettings,
  updateBarcodeJob,
  type LibraryBarcodeCopyRow,
  type LibraryBarcodeLabelPayload,
  type LibraryBarcodeLabelSettings,
} from '@/services/library';
import { apiErrorMessage } from '@/utils/api-error';
import {
  applyBarcodePreset,
  barcodeLabelDocument,
  preferPrinterStock,
  writeBarcodeSheet,
} from './library-barcode-print';

const BATCH = 100;

type Filters = {
  search: string;
  departmentId: string;
  categoryId: string;
  publisher: string;
  year: string;
  edition: string;
  printStatus: string;
  accessionFrom: string;
  accessionTo: string;
};

const EMPTY_FILTERS: Filters = {
  search: '',
  departmentId: '',
  categoryId: '',
  publisher: '',
  year: '',
  edition: '',
  printStatus: '',
  accessionFrom: '',
  accessionTo: '',
};

export function BarcodeManagementWorkspace() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const initialFilters = {
    ...EMPTY_FILTERS,
    printStatus: searchParams.get('printStatus') ?? '',
  };
  const [draft, setDraft] = useState<Filters>(initialFilters);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [progress, setProgress] = useState('');
  const [detail, setDetail] = useState<LibraryBarcodeCopyRow | null>(null);
  const [preview, setPreview] = useState<LibraryBarcodeLabelPayload | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(true);
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState<'accession' | 'title' | 'author' | 'status'>('accession');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [template, setTemplate] = useState<LibraryBarcodeLabelSettings | null>(null);

  const params = useMemo(
    () => compactFilters(filters, page, pageSize, { sort, sortDir }),
    [filters, page, pageSize, sort, sortDir],
  );
  const summary = useQuery({
    queryKey: ['library', 'barcodes', 'summary'],
    queryFn: fetchBarcodeSummary,
    enabled,
  });
  const copies = useQuery({
    queryKey: ['library', 'barcodes', 'copies', params],
    queryFn: () => fetchBarcodeCopies(params),
    enabled,
  });
  const settings = useQuery({
    queryKey: ['library', 'barcodes', 'settings'],
    queryFn: fetchBarcodeSettings,
    enabled,
  });
  const reports = useQuery({
    queryKey: ['library', 'barcodes', 'reports'],
    queryFn: fetchBarcodeReports,
    enabled,
  });
  const history = useQuery({
    queryKey: ['library', 'barcodes', 'jobs'],
    queryFn: () => fetchBarcodeJobs(1),
    enabled: enabled && showHistory,
  });
  const departments = useQuery({
    queryKey: ['organization', 'academic-departments'],
    queryFn: () => fetchAcademicDepartments(),
    enabled,
  });
  const categories = useQuery({
    queryKey: ['library', 'categories'],
    queryFn: fetchLibraryCategories,
    enabled,
  });

  useEffect(() => {
    if (settings.data?.template) setTemplate(preferPrinterStock(settings.data.template));
  }, [settings.data]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data as {
        source?: string;
        jobId?: string;
        status?: 'DIALOG_OPENED' | 'USER_CONFIRMED';
      };
      if (data?.source !== 'library-barcode' || !data.jobId || !data.status) return;
      void updateBarcodeJob(data.jobId, data.status).then(() => {
        if (data.status === 'USER_CONFIRMED') {
          void qc.invalidateQueries({ queryKey: ['library', 'barcodes', 'summary'] });
          void qc.invalidateQueries({ queryKey: ['library', 'barcodes', 'jobs'] });
        }
      });
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [qc]);

  const saveSettings = useMutation({
    mutationFn: () => saveBarcodeSettings(template as LibraryBarcodeLabelSettings),
    onSuccess: (result) => {
      setTemplate(result.template);
      setNotice(
        'Label settings saved. Print a test sheet at 100% scale before using a full batch.',
      );
      void qc.invalidateQueries({ queryKey: ['library', 'barcodes', 'settings'] });
    },
    onError: (error) => setNotice(apiErrorMessage(error)),
  });

  const rows = copies.data?.items ?? [];

  useEffect(() => {
    if (preview || !template || !rows.length) return;
    const row = rows.find((item) => item.printable);
    if (!row) return;
    void previewRow(row, false);
  }, [copies.data, template, preview]);
  const pageIds = rows.map((row) => row.copyId);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));

  function applyStatus(printStatus: string) {
    const next = { ...EMPTY_FILTERS, printStatus };
    setDraft(next);
    setFilters(next);
    setPage(1);
    setSelected([]);
  }

  function applyQuick(printStatus: string) {
    const next = { ...draft, printStatus };
    setDraft(next);
    setFilters(next);
    setPage(1);
  }

  function toggleSort(next: 'accession' | 'title' | 'author' | 'status') {
    setPage(1);
    if (sort === next) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSort(next);
    setSortDir('asc');
  }

  async function alignCopies(scope: 'ALL' | 'SELECTED') {
    setShowGenerate(false);
    if (scope === 'SELECTED' && !selected.length) {
      setNotice('Select at least one copy.');
      return;
    }
    if (scope === 'SELECTED' && selected.length > 500) {
      setNotice('Fill empty barcodes for 500 selected copies at a time.');
      return;
    }
    try {
      const result = await alignBarcodeCopies({
        scope,
        copyIds: scope === 'SELECTED' ? selected.slice(0, 500) : undefined,
      });
      setNotice(
        `${result.note} Filled ${result.updated}. Already matched ${result.alreadyMatched}. Left unchanged ${result.leftUnchanged}. Missing accession ${result.missingAccession}.`,
      );
      void qc.invalidateQueries({ queryKey: ['library', 'barcodes'] });
    } catch (error) {
      setNotice(apiErrorMessage(error));
    }
  }

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  async function selectMatching() {
    const result = await fetchBarcodeCopyIds(compactFilters(filters));
    const count = Math.min(result.total, result.ids.length);
    if (
      count > 200 &&
      !window.confirm(
        `Select ${count} copies from this filter? They will print in batches of ${BATCH}.`,
      )
    ) {
      return;
    }
    setSelected(result.ids);
    setNotice(
      result.truncated
        ? `Selected the first ${result.limit} of ${result.total} matches. Narrow the filters to print the rest.`
        : `Selected ${result.ids.length} copies.`,
    );
  }

  async function printIds(ids: string[], mode: 'INDIVIDUAL' | 'BULK' | 'REPRINT') {
    if (!template) return;
    const unique = [...new Set(ids)];
    if (!unique.length) {
      setNotice('Select at least one copy.');
      return;
    }
    if (
      unique.length > 200 &&
      !window.confirm(`Print ${unique.length} labels in batches of ${BATCH}?`)
    )
      return;
    const chunks: string[][] = [];
    for (let index = 0; index < unique.length; index += BATCH)
      chunks.push(unique.slice(index, index + BATCH));
    for (let index = 0; index < chunks.length; index += 1) {
      setProgress(`Batch ${index + 1} of ${chunks.length}`);
      try {
        const checked = await previewBarcodeLabels(chunks[index]);
        if (checked.rejected.length) {
          setNotice(
            checked.rejected
              .map((row) => `${row.accessionNumber || 'Copy'}: ${row.reason}`)
              .join(' · '),
          );
        }
        if (!checked.labels.length) continue;
        const job = await createBarcodeJob({
          copyIds: checked.labels.map((label) => label.copyId),
          mode,
        });
        const popup = window.open('', '_blank');
        if (!popup) {
          setNotice(
            'Allow pop-up windows to print labels. The print job stays prepared until the dialog opens.',
          );
          return;
        }
        writeBarcodeSheet(popup, job.labels, template, { autoPrint: true, jobId: job.jobId });
        await waitForPopup(popup);
      } catch (error) {
        setNotice(apiErrorMessage(error));
        return;
      }
    }
    setProgress('');
    setNotice(
      'Print dialog closed for the selected labels. Closing the dialog does not prove the printer finished.',
    );
    void qc.invalidateQueries({ queryKey: ['library', 'barcodes'] });
  }

  async function previewSelected() {
    const ids = selected.slice(0, BATCH);
    if (!ids.length || !template) return;
    const checked = await previewBarcodeLabels(ids);
    if (!checked.labels.length) {
      setNotice(checked.rejected[0]?.reason ?? 'None of the selected copies can be printed.');
      return;
    }
    setPreview(checked.labels[0]);
    const popup = window.open('', '_blank');
    if (!popup) return;
    writeBarcodeSheet(popup, checked.labels, template, { autoPrint: false });
  }

  async function exportReport(key: string, format: 'xlsx' | 'csv' | 'pdf') {
    const blob = await downloadBarcodeReport(key, format, compactFilters(filters));
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${key}.${format === 'pdf' ? 'pdf' : format === 'csv' ? 'csv' : 'xlsx'}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Barcode className="h-5 w-5" />
            </span>
            Barcode Management
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Generate, preview, manage, and print barcode labels for library book copies.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setShowTemplates((open) => !open);
              setShowHistory(false);
            }}
          >
            Label Templates
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setShowHistory((open) => !open);
              setShowTemplates(false);
            }}
          >
            Print History
          </Button>
          <div className="relative">
            <Button type="button" onClick={() => setShowGenerate((open) => !open)}>
              Generate Barcodes
              <ChevronDown className="ml-1 h-4 w-4" />
            </Button>
            {showGenerate ? (
              <div className="absolute right-0 z-20 mt-1 w-72 rounded-xl border bg-white p-1 text-sm shadow-lg">
                <MenuButton onClick={() => void alignCopies('ALL')}>
                  Fill empty barcodes for every copy
                </MenuButton>
                <MenuButton onClick={() => void alignCopies('SELECTED')}>
                  Fill empty barcodes for the selection
                </MenuButton>
                <MenuButton
                  onClick={() => {
                    setShowGenerate(false);
                    void printIds(selected, 'REPRINT');
                  }}
                >
                  Reprint selected labels
                </MenuButton>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Stat
          label="Total Copies"
          hint="All physical copies"
          value={summary.data?.totalCopies}
          tone="blue"
          icon={<BookOpen className="h-4 w-4" />}
          active={!filters.printStatus}
          onClick={() => applyStatus('')}
        />
        <Stat
          label="With Accession Number"
          hint={
            summary.data && summary.data.totalCopies > 0
              ? `${((summary.data.withAccession / summary.data.totalCopies) * 100).toFixed(2)}% have an accession number`
              : 'Copies with an accession number'
          }
          value={summary.data?.withAccession}
          tone="green"
          icon={<Barcode className="h-4 w-4" />}
          active={filters.printStatus === 'HAS_ACCESSION'}
          onClick={() => applyStatus('HAS_ACCESSION')}
        />
        <Stat
          label="Ready to Print"
          hint="Accession matches the barcode and no dialog has been confirmed"
          value={summary.data?.readyToPrint}
          tone="violet"
          icon={<Printer className="h-4 w-4" />}
          active={filters.printStatus === 'UNPRINTED'}
          onClick={() => applyStatus('UNPRINTED')}
        />
        <Stat
          label="Print Confirmed"
          hint="Browser print dialog closed"
          value={summary.data?.confirmedLabels}
          tone="green"
          icon={<CheckCircle2 className="h-4 w-4" />}
          active={filters.printStatus === 'CONFIRMED'}
          onClick={() => applyStatus('CONFIRMED')}
        />
        <Stat
          label="Missing Accession Number"
          hint="Cannot print until an accession exists"
          value={summary.data?.missingAccession}
          tone="amber"
          icon={<AlertTriangle className="h-4 w-4" />}
          active={filters.printStatus === 'MISSING'}
          onClick={() => applyStatus('MISSING')}
        />
        <Stat
          label="Duplicate Accession Number"
          hint="Same trimmed accession on more than one copy"
          value={summary.data?.duplicateAccessionNumbers}
          tone="rose"
          icon={<AlertTriangle className="h-4 w-4" />}
          active={filters.printStatus === 'DUPLICATE'}
          onClick={() => applyStatus('DUPLICATE')}
        />
      </div>
      <p className="text-xs text-slate-500">
        {summary.data?.note}{' '}
        {template?.preset === 'ZEBRA_2UP'
          ? 'Each book prints twice on one row: the left sticker for the cover and the right sticker for inside the book. Paper size 4.00 × 0.98 inch, margins None, scale 100%.'
          : 'For A4 sheets, set the paper to A4, scale 100% or Actual Size, and turn off browser headers and footers.'}
      </p>

      {notice ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {notice}
        </div>
      ) : null}
      {progress ? <p className="text-sm font-medium text-slate-700">{progress}</p> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-3">
          <div className={`${librarySearchPanelClass} space-y-4`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-900">Search & Filter</h2>
                <p className="text-xs text-slate-500">
                  Find physical copies by accession number, title, author, ISBN, call number, or
                  barcode.
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                {[
                  ['', 'All'],
                  ['UNPRINTED', 'Not Printed'],
                  ['CONFIRMED', 'Printed'],
                  ['MISSING', 'Missing Accession'],
                  ['DUPLICATE', 'Duplicates'],
                ].map(([value, label]) => (
                  <button
                    key={label}
                    type="button"
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      filters.printStatus === value
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                    onClick={() => applyQuick(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <label className={libraryFilterLabelClass}>
                Search
                <div className="relative mt-1.5">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                  <Input
                    className={librarySearchInputClass}
                    placeholder="Accession, title, author, ISBN, call number"
                    value={draft.search}
                    onChange={(event) => setDraft({ ...draft, search: event.target.value })}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        setPage(1);
                        setFilters(draft);
                      }
                    }}
                  />
                </div>
              </label>
              <label className={libraryFilterLabelClass}>
                Department
                <Select
                  className={`mt-1.5 ${libraryFilterControlClass}`}
                  value={draft.departmentId}
                  placeholder="All departments"
                  onChange={(value) => setDraft({ ...draft, departmentId: value })}
                >
                  {(departments.data ?? []).map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </Select>
              </label>
              <label className={libraryFilterLabelClass}>
                Book category
                <Select
                  className={`mt-1.5 ${libraryFilterControlClass}`}
                  value={draft.categoryId}
                  placeholder="All categories"
                  onChange={(value) => setDraft({ ...draft, categoryId: value })}
                >
                  {(categories.data ?? []).map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </label>
              {showAdvanced ? (
                <>
                  <label className={libraryFilterLabelClass}>
                    Publisher
                    <Input
                      className={`mt-1.5 ${libraryFilterControlClass}`}
                      placeholder="Publisher"
                      value={draft.publisher}
                      onChange={(event) => setDraft({ ...draft, publisher: event.target.value })}
                    />
                  </label>
                  <label className={libraryFilterLabelClass}>
                    Publication year
                    <Input
                      className={`mt-1.5 ${libraryFilterControlClass}`}
                      placeholder="Publication year"
                      value={draft.year}
                      onChange={(event) => setDraft({ ...draft, year: event.target.value })}
                    />
                  </label>
                  <label className={libraryFilterLabelClass}>
                    Edition
                    <Input
                      className={`mt-1.5 ${libraryFilterControlClass}`}
                      placeholder="Edition"
                      value={draft.edition}
                      onChange={(event) => setDraft({ ...draft, edition: event.target.value })}
                    />
                  </label>
                  <label className={libraryFilterLabelClass}>
                    Printing status
                    <Select
                      className={`mt-1.5 ${libraryFilterControlClass}`}
                      value={draft.printStatus}
                      placeholder="All statuses"
                      onChange={(value) => setDraft({ ...draft, printStatus: value })}
                    >
                      <option value="HAS_ACCESSION">With accession number</option>
                      <option value="UNPRINTED">Not printed</option>
                      <option value="CONFIRMED">Printed</option>
                      <option value="MISSING">Missing accession</option>
                      <option value="DUPLICATE">Duplicates</option>
                      <option value="LOCAL_UNPRINTED">Not printed in this ERP</option>
                      <option value="NOT_PRINTABLE">Not printable</option>
                    </Select>
                  </label>
                  <label className={libraryFilterLabelClass}>
                    Accession from
                    <Input
                      className={`mt-1.5 ${libraryFilterControlClass}`}
                      placeholder="Accession from"
                      value={draft.accessionFrom}
                      onChange={(event) =>
                        setDraft({ ...draft, accessionFrom: event.target.value })
                      }
                    />
                  </label>
                  <label className={libraryFilterLabelClass}>
                    Accession to
                    <Input
                      className={`mt-1.5 ${libraryFilterControlClass}`}
                      placeholder="Accession to"
                      value={draft.accessionTo}
                      onChange={(event) => setDraft({ ...draft, accessionTo: event.target.value })}
                    />
                  </label>
                </>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                className={librarySearchButtonClass}
                onClick={() => {
                  setPage(1);
                  setFilters(draft);
                }}
              >
                <Search className="mr-1 h-4 w-4" /> Search
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDraft(EMPTY_FILTERS);
                  setFilters(EMPTY_FILTERS);
                  setPage(1);
                }}
              >
                Reset
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAdvanced((open) => !open)}
              >
                Advanced Filters
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-white p-3 text-sm shadow-sm">
            <p className="mr-auto font-medium text-slate-700">
              Book Copies ({copies.data?.total ?? 0})
              {selected.length ? (
                <span className="ml-2 font-normal text-blue-700">{selected.length} selected</span>
              ) : null}
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setSelected(
                  allPageSelected
                    ? selected.filter((id) => !pageIds.includes(id))
                    : [...new Set([...selected, ...pageIds])],
                )
              }
            >
              {allPageSelected ? 'Clear page' : 'Select page'}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void selectMatching()}>
              Select matching
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setSelected([])}>
              Clear selection
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!selected.length}
              onClick={() => void printIds(selected, selected.length > 1 ? 'BULK' : 'INDIVIDUAL')}
            >
              <Printer className="mr-1 h-3.5 w-3.5" /> Print Selected ({selected.length})
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!selected.length}
              onClick={() => void previewSelected()}
            >
              Preview Sheet
            </Button>
            <div className="relative">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowExport((open) => !open)}
              >
                Export
              </Button>
              {showExport ? (
                <div className="absolute right-0 z-20 mt-1 max-h-72 w-64 overflow-auto rounded-xl border bg-white p-1 text-sm shadow-lg">
                  {(reports.data ?? []).map((report) => (
                    <div
                      key={report.key}
                      className="flex items-center justify-between gap-2 px-2 py-1"
                    >
                      <span className="truncate">{report.title}</span>
                      <span className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          className="text-xs text-blue-700"
                          onClick={() => {
                            setShowExport(false);
                            void exportReport(report.key, 'xlsx');
                          }}
                        >
                          Excel
                        </button>
                        <button
                          type="button"
                          className="text-xs text-blue-700"
                          onClick={() => {
                            setShowExport(false);
                            void exportReport(report.key, 'csv');
                          }}
                        >
                          CSV
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <Select
              value={String(pageSize)}
              placeholder="Page size"
              onChange={(value) => {
                setPageSize(Number(value));
                setPage(1);
              }}
            >
              <option value="10">10 per page</option>
              <option value="25">25 per page</option>
              <option value="50">50 per page</option>
              <option value="100">100 per page</option>
            </Select>
          </div>

          <div className="max-h-[640px] overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 z-10 border-b bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-2 py-2" />
                  <th className="px-2 py-2">Sl.</th>
                  <SortHeader
                    label="Accession No."
                    active={sort === 'accession'}
                    dir={sortDir}
                    onClick={() => toggleSort('accession')}
                  />
                  <SortHeader
                    label="Title"
                    active={sort === 'title'}
                    dir={sortDir}
                    onClick={() => toggleSort('title')}
                  />
                  <SortHeader
                    label="Author"
                    active={sort === 'author'}
                    dir={sortDir}
                    onClick={() => toggleSort('author')}
                  />
                  <th className="px-2 py-2">Department</th>
                  <th className="px-2 py-2">Call No.</th>
                  <th className="px-2 py-2">Copy type</th>
                  <th className="px-2 py-2">ISBN</th>
                  <SortHeader
                    label="Status"
                    active={sort === 'status'}
                    dir={sortDir}
                    onClick={() => toggleSort('status')}
                  />
                  <th className="px-2 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const badge = statusBadge(row);
                  return (
                    <tr
                      key={row.copyId}
                      className={`border-b align-top ${row.printable ? 'hover:bg-slate-50' : 'bg-amber-50/40'}`}
                      onClick={() => void previewRow(row, false)}
                    >
                      <td className="px-2 py-2" onClick={(event) => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.includes(row.copyId)}
                          onChange={() => toggle(row.copyId)}
                        />
                      </td>
                      <td className="px-2 py-2 text-slate-500">
                        {(page - 1) * pageSize + index + 1}
                      </td>
                      <td className="px-2 py-2 font-mono text-xs">{row.accessionNumber || '—'}</td>
                      <td className="px-2 py-2">{row.title}</td>
                      <td className="px-2 py-2">{row.author || '—'}</td>
                      <td className="px-2 py-2">{row.department || '—'}</td>
                      <td className="px-2 py-2">{row.callNumber || '—'}</td>
                      <td className="px-2 py-2">{row.copyType || '—'}</td>
                      <td className="px-2 py-2 font-mono text-xs">{row.isbn || '—'}</td>
                      <td className="px-2 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${badge.className}`}
                          title={row.blocker ?? undefined}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-2 py-2" onClick={(event) => event.stopPropagation()}>
                        <div className="flex flex-wrap gap-1">
                          <IconButton label="Preview" onClick={() => void previewRow(row)}>
                            <Eye className="h-3.5 w-3.5" />
                          </IconButton>
                          <IconButton
                            label="Print"
                            disabled={!row.printable}
                            onClick={() => void printIds([row.copyId], 'INDIVIDUAL')}
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </IconButton>
                          <IconButton
                            label="Reprint"
                            disabled={!row.printable}
                            onClick={() => void printIds([row.copyId], 'REPRINT')}
                          >
                            Reprint
                          </IconButton>
                          <IconButton label="Details" onClick={() => setDetail(row)}>
                            Details
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!rows.length ? (
              <p className="py-8 text-center text-sm text-slate-500">
                No copies match this search.
              </p>
            ) : null}
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>
              Showing {(page - 1) * pageSize + (rows.length ? 1 : 0)}–
              {(page - 1) * pageSize + rows.length} of {copies.data?.total ?? 0}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
              >
                Previous
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={page * pageSize >= (copies.data?.total ?? 0)}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-xl border bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Label Preview</h2>
              <button
                type="button"
                className="text-xs font-medium text-blue-700"
                disabled={!preview || !template}
                onClick={() => {
                  if (!preview || !template) return;
                  const popup = window.open('', '_blank');
                  if (!popup) return;
                  writeBarcodeSheet(popup, [preview], template, { autoPrint: false });
                }}
              >
                Full Preview
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {template?.preset === 'ZEBRA_2UP'
                ? 'Each book prints twice: left sticker for the cover, right sticker for inside the book.'
                : 'This is the label that will print for the selected copy.'}
            </p>
            {preview && template ? (
              <iframe
                title="Barcode label preview"
                className="mt-3 w-full border bg-white"
                style={{ height: template.preset === 'ZEBRA_2UP' ? '130px' : '220px' }}
                srcDoc={barcodeLabelDocument(
                  [preview],
                  template.preset === 'ZEBRA_2UP'
                    ? template
                    : {
                        ...template,
                        columns: 1,
                        rows: 1,
                        pageWidthMm: template.labelWidthMm + 4,
                        pageHeightMm: template.labelHeightMm + 4,
                        marginTopMm: 2,
                        marginRightMm: 2,
                        marginBottomMm: 2,
                        marginLeftMm: 2,
                      },
                  { autoPrint: false },
                )}
              />
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                Choose Preview on a copy to see its label.
              </p>
            )}
          </section>
          {template ? (
            <SettingsPanel
              template={template}
              institutionName={settings.data?.institutionName ?? ''}
              saving={saveSettings.isPending}
              onChange={setTemplate}
              onSave={() => saveSettings.mutate()}
              onTest={() => {
                const id = preview?.copyId ?? selected[0];
                if (!id) {
                  setNotice('Preview a copy before printing a test label.');
                  return;
                }
                void printIds([id], 'INDIVIDUAL');
              }}
            />
          ) : null}
        </aside>
      </div>

      {detail ? (
        <section className="rounded-xl border bg-white p-4 text-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">{detail.title}</h2>
            <Button type="button" size="sm" variant="ghost" onClick={() => setDetail(null)}>
              Close
            </Button>
          </div>
          <dl className="grid gap-2 sm:grid-cols-2">
            <Detail label="Accession number" value={detail.accessionNumber} />
            <Detail label="Barcode value" value={detail.barcode} />
            <Detail label="Author" value={detail.author} />
            <Detail label="Department" value={detail.department} />
            <Detail label="Call number" value={detail.callNumber} />
            <Detail label="ISBN" value={detail.isbn} />
            <Detail label="Publisher" value={detail.publisher} />
            <Detail
              label="Edition / year"
              value={[detail.edition, detail.publicationYear].filter(Boolean).join(' · ')}
            />
            <Detail label="Category" value={detail.category} />
            <Detail label="Copy status" value={detail.copyStatus} />
          </dl>
        </section>
      ) : null}

      {showTemplates && template ? (
        <section className="rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold">Label templates</h2>
          <p className="mt-1 text-xs text-slate-500">
            Choose a stock. Zebra 50×25 is the GT800 pair. A4 prints eight labels with the college
            heading when the logo and book details are on. Save stores the current stock as the
            default.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(['ZEBRA_2UP', 'A4_2X4', 'SINGLE', 'ROLL', 'CUSTOM'] as const).map((preset) => (
              <Button
                key={preset}
                type="button"
                size="sm"
                variant={template.preset === preset ? 'default' : 'outline'}
                onClick={() =>
                  setTemplate(templateFromPreset(template, preset, settings.data?.institutionName))
                }
              >
                {presetLabel(preset)}
              </Button>
            ))}
          </div>
        </section>
      ) : null}

      {showHistory ? (
        <section className="rounded-xl border bg-white p-4">
          <h2 className="text-sm font-semibold">Print history</h2>
          <p className="mt-1 text-xs text-slate-500">{history.data?.note}</p>
          <ul className="mt-3 divide-y text-sm">
            {(history.data?.items ?? []).map((job) => (
              <li key={job.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <p>
                    {new Date(job.createdAt).toLocaleString()} · {job.actorLabel || 'Staff'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {job.mode} · {job.status} · {job.labelCount} labels ·{' '}
                    {job.sampleAccessions.join(', ')}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void printIds(job.copyIds, 'REPRINT')}
                >
                  Reprint
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-xl border bg-white p-4">
        <h2 className="text-sm font-semibold">Barcode reports</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {(reports.data ?? []).map((report) => (
            <li key={report.key} className="flex flex-wrap items-center justify-between gap-2">
              <span>{report.title}</span>
              <span className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void exportReport(report.key, 'xlsx')}
                >
                  Excel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void exportReport(report.key, 'pdf')}
                >
                  PDF
                </Button>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );

  async function previewRow(row: LibraryBarcodeCopyRow, openDetails = true) {
    const checked = await previewBarcodeLabels([row.copyId]);
    if (!checked.labels[0]) {
      setNotice(checked.rejected[0]?.reason ?? 'This copy cannot be printed.');
      if (openDetails) setDetail(row);
      return;
    }
    setPreview(checked.labels[0]);
    if (openDetails) setDetail(row);
  }
}

function SettingsPanel({
  template,
  institutionName,
  saving,
  onChange,
  onSave,
  onTest,
}: {
  template: LibraryBarcodeLabelSettings;
  institutionName: string;
  saving: boolean;
  onChange: (template: LibraryBarcodeLabelSettings) => void;
  onSave: () => void;
  onTest: () => void;
}) {
  function setNumber<K extends keyof LibraryBarcodeLabelSettings>(key: K, value: string) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    onChange({ ...template, [key]: parsed, preset: key === 'preset' ? template.preset : 'CUSTOM' });
  }
  return (
    <section className="rounded-xl border bg-white p-4 text-sm">
      <h2 className="font-semibold">Print settings</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {(['ZEBRA_2UP', 'A4_2X4', 'SINGLE', 'ROLL', 'CUSTOM'] as const).map((preset) => (
          <Button
            key={preset}
            type="button"
            size="sm"
            variant={template.preset === preset ? 'default' : 'outline'}
            onClick={() => onChange(templateFromPreset(template, preset, institutionName))}
          >
            {preset === 'ZEBRA_2UP'
              ? 'Zebra 50×25'
              : preset === 'A4_2X4'
                ? 'A4 2×4'
                : preset === 'SINGLE'
                  ? 'Single label'
                  : preset === 'ROLL'
                    ? 'Label roll'
                    : 'Custom'}
          </Button>
        ))}
      </div>
      {template.preset === 'ZEBRA_2UP' ? (
        <p className="mt-3 text-xs leading-5 text-slate-500">
          Zebra GT800 user-defined stock, 4.00 × 0.98 inch, portrait. Each book uses both stickers
          on the row, so you can paste one on the cover and one inside. Margins None, scale 100%.
        </p>
      ) : null}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <NumberField
          label="Label width mm"
          value={template.labelWidthMm}
          onChange={(value) => setNumber('labelWidthMm', value)}
        />
        <NumberField
          label="Label height mm"
          value={template.labelHeightMm}
          onChange={(value) => setNumber('labelHeightMm', value)}
        />
        <NumberField
          label="Columns"
          value={template.columns}
          onChange={(value) => setNumber('columns', value)}
        />
        <NumberField
          label="Rows"
          value={template.rows}
          onChange={(value) => setNumber('rows', value)}
        />
        <NumberField
          label="Top margin"
          value={template.marginTopMm}
          onChange={(value) => setNumber('marginTopMm', value)}
        />
        <NumberField
          label="Bottom margin"
          value={template.marginBottomMm}
          onChange={(value) => setNumber('marginBottomMm', value)}
        />
        <NumberField
          label="Left margin"
          value={template.marginLeftMm}
          onChange={(value) => setNumber('marginLeftMm', value)}
        />
        <NumberField
          label="Right margin"
          value={template.marginRightMm}
          onChange={(value) => setNumber('marginRightMm', value)}
        />
        <NumberField
          label="Horizontal gap"
          value={template.gapXMm}
          onChange={(value) => setNumber('gapXMm', value)}
        />
        <NumberField
          label="Vertical gap"
          value={template.gapYMm}
          onChange={(value) => setNumber('gapYMm', value)}
        />
        <NumberField
          label="Barcode height mm"
          value={template.barcodeHeightMm}
          onChange={(value) => setNumber('barcodeHeightMm', value)}
        />
        <NumberField
          label="Module width"
          value={template.moduleWidth}
          onChange={(value) => setNumber('moduleWidth', value)}
        />
        <NumberField
          label="Font size pt"
          value={template.fontSizePt}
          onChange={(value) => setNumber('fontSizePt', value)}
        />
      </div>
      {template.preset === 'ZEBRA_2UP' ? (
        <label className="mt-3 block text-xs text-slate-500">
          Library code
          <Input
            className="mt-1 uppercase"
            maxLength={12}
            value={template.headerCode}
            onChange={(event) =>
              onChange({ ...template, headerCode: event.target.value.toUpperCase() })
            }
          />
        </label>
      ) : null}
      <div className="mt-3 space-y-1">
        {template.preset === 'ZEBRA_2UP' ? null : (
          <>
            <Check
              label="Show college logo"
              checked={template.showLogo}
              onChange={(checked) => onChange({ ...template, showLogo: checked })}
            />
            <Check
              label="Show book details"
              checked={template.showTitle && template.showAuthor}
              onChange={(checked) =>
                onChange({ ...template, showTitle: checked, showAuthor: checked })
              }
            />
            <Check
              label="Book title"
              checked={template.showTitle}
              onChange={(checked) => onChange({ ...template, showTitle: checked })}
            />
            <Check
              label="Author"
              checked={template.showAuthor}
              onChange={(checked) => onChange({ ...template, showAuthor: checked })}
            />
            <Check
              label="Department"
              checked={template.showDepartment}
              onChange={(checked) => onChange({ ...template, showDepartment: checked })}
            />
          </>
        )}
        <Check
          label="Call number"
          checked={template.showCallNumber}
          onChange={(checked) => onChange({ ...template, showCallNumber: checked })}
        />
        <Check
          label="Accession number"
          checked={template.showAccession}
          onChange={(checked) => onChange({ ...template, showAccession: checked })}
        />
      </div>
      <div className="mt-3 grid gap-2">
        <Button type="button" variant="outline" onClick={onTest}>
          Print Test Label
        </Button>
        <Button type="button" disabled={saving} onClick={onSave}>
          {saving ? 'Saving…' : 'Save as Default Settings'}
        </Button>
      </div>
    </section>
  );
}

function waitForPopup(popup: Window) {
  return new Promise<void>((resolve) => {
    const timer = window.setInterval(() => {
      if (popup.closed) {
        window.clearInterval(timer);
        resolve();
      }
    }, 400);
  });
}

function compactFilters(
  filters: Filters,
  page?: number,
  pageSize = 25,
  sort?: { sort: string; sortDir: string },
) {
  return {
    search: filters.search || undefined,
    departmentId: filters.departmentId || undefined,
    categoryId: filters.categoryId || undefined,
    publisher: filters.publisher || undefined,
    year: filters.year || undefined,
    edition: filters.edition || undefined,
    printStatus: filters.printStatus || undefined,
    accessionFrom: filters.accessionFrom || undefined,
    accessionTo: filters.accessionTo || undefined,
    sort: sort?.sort,
    sortDir: sort?.sortDir,
    page,
    limit: page ? pageSize : undefined,
  };
}

function printLabel(status: string) {
  if (status === 'CONFIRMED') return 'Confirmed';
  if (status === 'DIALOG_OPENED') return 'Dialog opened';
  if (status === 'PREPARED') return 'Prepared';
  return 'Not printed';
}

function Stat({
  label,
  hint,
  value,
  tone,
  icon,
  active,
  onClick,
}: {
  label: string;
  hint: string;
  value?: number;
  tone: 'blue' | 'green' | 'violet' | 'amber' | 'rose';
  icon: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  const tones = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-emerald-50 text-emerald-600',
    violet: 'bg-violet-50 text-violet-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border bg-white p-4 text-left shadow-sm ${active ? 'ring-2 ring-blue-500' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            {value ?? '…'}
          </p>
          <p className="mt-1 text-xs text-slate-500">{hint}</p>
        </div>
        <span className={`rounded-xl p-2 ${tones[tone]}`}>{icon}</span>
      </div>
    </button>
  );
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: 'asc' | 'desc';
  onClick: () => void;
}) {
  return (
    <th className="px-2 py-2">
      <button type="button" className="font-medium uppercase" onClick={onClick}>
        {label}
        {active ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}
      </button>
    </th>
  );
}

function MenuButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      className="block w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function presetLabel(preset: LibraryBarcodeLabelSettings['preset']) {
  if (preset === 'ZEBRA_2UP') return 'Zebra 50×25';
  if (preset === 'A4_2X4') return 'A4 (2×4)';
  if (preset === 'SINGLE') return 'Single Label';
  if (preset === 'ROLL') return 'Label Roll';
  return 'Custom';
}

function templateFromPreset(
  template: LibraryBarcodeLabelSettings,
  preset: LibraryBarcodeLabelSettings['preset'],
  institutionName?: string,
) {
  const next = applyBarcodePreset(template, preset);
  if (preset !== 'A4_2X4') return next;
  return {
    ...next,
    showLogo: true,
    showTitle: true,
    showAuthor: true,
    showDepartment: true,
    showCallNumber: true,
    showAccession: true,
    headerTitle: next.headerTitle || (institutionName || 'DON BOSCO COLLEGE, TURA').toUpperCase(),
    headerSubtitle: next.headerSubtitle || 'LIBRARY',
    headerCode: next.headerCode || 'DBCL',
  };
}

function statusBadge(row: LibraryBarcodeCopyRow) {
  if (!row.accessionNumber.trim()) {
    return { label: 'Missing', className: 'bg-amber-50 text-amber-800' };
  }
  if (row.blocker?.toLowerCase().includes('duplicate')) {
    return { label: 'Duplicate', className: 'bg-rose-50 text-rose-800' };
  }
  if (!row.printable) {
    return { label: 'Check barcode', className: 'bg-amber-50 text-amber-900' };
  }
  if (row.printStatus === 'CONFIRMED') {
    return { label: 'Printed', className: 'bg-emerald-50 text-emerald-700' };
  }
  if (row.printStatus === 'DIALOG_OPENED' || row.printStatus === 'PREPARED') {
    return { label: 'Print initiated', className: 'bg-sky-50 text-sky-800' };
  }
  return { label: 'Not printed', className: 'bg-orange-50 text-orange-700' };
}

function Select({
  value,
  placeholder,
  onChange,
  children,
  className,
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <select
      className={className ?? 'h-10 rounded-md border bg-white px-3 text-sm'}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{placeholder}</option>
      {children}
    </select>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded border px-1.5 py-1 text-xs disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd>{value || '—'}</dd>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-xs text-slate-600">
      {label}
      <input
        className="mt-1 h-8 w-full rounded border px-2 text-sm"
        type="number"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}
