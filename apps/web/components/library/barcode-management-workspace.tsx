'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Barcode, CheckCircle2, Eye, Printer, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchAcademicDepartments } from '@/services/organization';
import {
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
  const [template, setTemplate] = useState<LibraryBarcodeLabelSettings | null>(null);

  const params = useMemo(() => compactFilters(filters, page), [filters, page]);
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
  const pageIds = rows.map((row) => row.copyId);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));

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

  async function exportReport(key: string, format: 'xlsx' | 'pdf') {
    const blob = await downloadBarcodeReport(key, format, compactFilters(filters));
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${key}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
            <Barcode className="h-6 w-6" />
            Barcode Management
          </h1>
          <p className="text-sm text-slate-500">Library / Barcode Management</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => setShowHistory((open) => !open)}>
            Print History
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Stat label="Total copies" value={summary.data?.totalCopies} />
        <Stat label="With accession no." value={summary.data?.withAccession} />
        <Stat label="Ready to print" value={summary.data?.printable} />
        <Stat label="Print confirmed" value={summary.data?.confirmedLabels} />
        <Stat label="Missing accession no." value={summary.data?.missingAccession} warn />
        <Stat
          label="Duplicate accession no."
          value={summary.data?.duplicateAccessionNumbers}
          warn
        />
      </div>
      <p className="text-xs text-slate-500">
        {summary.data?.note} Set the printer to A4, scale 100% or Actual Size, and turn off browser
        headers and footers. The printer’s own margins still apply, so print one test sheet before a
        batch.
      </p>

      {notice ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {notice}
        </div>
      ) : null}
      {progress ? <p className="text-sm font-medium text-slate-700">{progress}</p> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-3 rounded-xl border bg-white p-4">
          <div className="grid gap-2 md:grid-cols-3">
            <Input
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
            <Select
              value={draft.departmentId}
              placeholder="Department"
              onChange={(value) => setDraft({ ...draft, departmentId: value })}
            >
              {(departments.data ?? []).map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </Select>
            <Select
              value={draft.categoryId}
              placeholder="Book category"
              onChange={(value) => setDraft({ ...draft, categoryId: value })}
            >
              {(categories.data ?? []).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
            <Input
              placeholder="Publisher"
              value={draft.publisher}
              onChange={(event) => setDraft({ ...draft, publisher: event.target.value })}
            />
            <Input
              placeholder="Publication year"
              value={draft.year}
              onChange={(event) => setDraft({ ...draft, year: event.target.value })}
            />
            <Input
              placeholder="Edition"
              value={draft.edition}
              onChange={(event) => setDraft({ ...draft, edition: event.target.value })}
            />
            <Select
              value={draft.printStatus}
              placeholder="Printing status"
              onChange={(value) => setDraft({ ...draft, printStatus: value })}
            >
              <option value="CONFIRMED">Print confirmed</option>
              <option value="UNPRINTED">Not confirmed</option>
              <option value="LOCAL_UNPRINTED">Not printed in this ERP</option>
              <option value="NOT_PRINTABLE">Missing or duplicate accession</option>
            </Select>
            <Input
              placeholder="Accession from"
              value={draft.accessionFrom}
              onChange={(event) => setDraft({ ...draft, accessionFrom: event.target.value })}
            />
            <Input
              placeholder="Accession to"
              value={draft.accessionTo}
              onChange={(event) => setDraft({ ...draft, accessionTo: event.target.value })}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
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
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={allPageSelected}
                onChange={() =>
                  setSelected(
                    allPageSelected
                      ? selected.filter((id) => !pageIds.includes(id))
                      : [...new Set([...selected, ...pageIds])],
                  )
                }
              />
              Select page
            </label>
            <Button type="button" size="sm" variant="outline" onClick={() => void selectMatching()}>
              Select all matching
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setSelected([])}>
              Clear {selected.length || ''}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!selected.length}
              onClick={() => void printIds(selected, selected.length > 1 ? 'BULK' : 'INDIVIDUAL')}
            >
              <Printer className="mr-1 h-3.5 w-3.5" /> Print selected ({selected.length})
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!selected.length}
              onClick={() => void previewSelected()}
            >
              Preview sheet
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-2 py-2" />
                  <th className="px-2 py-2">Accession</th>
                  <th className="px-2 py-2">Title</th>
                  <th className="px-2 py-2">Author</th>
                  <th className="px-2 py-2">Department</th>
                  <th className="px-2 py-2">Call no.</th>
                  <th className="px-2 py-2">ISBN</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.copyId} className="border-b align-top">
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={selected.includes(row.copyId)}
                        onChange={() => toggle(row.copyId)}
                      />
                    </td>
                    <td className="px-2 py-2 font-mono text-xs">{row.accessionNumber || '—'}</td>
                    <td className="px-2 py-2">{row.title}</td>
                    <td className="px-2 py-2">{row.author || '—'}</td>
                    <td className="px-2 py-2">{row.department || '—'}</td>
                    <td className="px-2 py-2">{row.callNumber || '—'}</td>
                    <td className="px-2 py-2 font-mono text-xs">{row.isbn || '—'}</td>
                    <td className="px-2 py-2">
                      {row.printable ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">
                          {printLabel(row.printStatus)}
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-900">
                          {row.blocker}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2">
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
                ))}
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
              Showing {rows.length} of {copies.data?.total ?? 0}
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
                disabled={page * (copies.data?.limit ?? 25) >= (copies.data?.total ?? 0)}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-xl border bg-white p-4">
            <h2 className="text-sm font-semibold">Label preview</h2>
            {template?.preset === 'ZEBRA_2UP' ? (
              <p className="mt-1 text-xs text-slate-500">
                50 × 25 mm, two labels across a 104 mm roll. Print at 100% scale.
              </p>
            ) : null}
            {preview && template ? (
              <iframe
                title="Barcode label preview"
                className="mt-3 w-full border bg-white"
                style={{ height: template.preset === 'ZEBRA_2UP' ? '150px' : '220px' }}
                srcDoc={barcodeLabelDocument(
                  [preview],
                  {
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
              saving={saveSettings.isPending}
              onChange={setTemplate}
              onSave={() => saveSettings.mutate()}
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

  async function previewRow(row: LibraryBarcodeCopyRow) {
    const checked = await previewBarcodeLabels([row.copyId]);
    if (!checked.labels[0]) {
      setNotice(checked.rejected[0]?.reason ?? 'This copy cannot be printed.');
      setDetail(row);
      return;
    }
    setPreview(checked.labels[0]);
    setDetail(row);
  }
}

function SettingsPanel({
  template,
  saving,
  onChange,
  onSave,
}: {
  template: LibraryBarcodeLabelSettings;
  saving: boolean;
  onChange: (template: LibraryBarcodeLabelSettings) => void;
  onSave: () => void;
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
            onClick={() => onChange(applyBarcodePreset(template, preset))}
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
          Zebra GT800, two 50 × 25 mm stickers on a 104 mm roll. Each row is one page. The sticker
          prints the barcode, accession number, library code, and call number.
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
              label="College logo"
              checked={template.showLogo}
              onChange={(checked) => onChange({ ...template, showLogo: checked })}
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
      <Button className="mt-3 w-full" type="button" disabled={saving} onClick={onSave}>
        {saving ? 'Saving…' : 'Save as default'}
      </Button>
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

function compactFilters(filters: Filters, page?: number) {
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
    page,
    limit: page ? 25 : undefined,
  };
}

function printLabel(status: string) {
  if (status === 'CONFIRMED') return 'Confirmed';
  if (status === 'DIALOG_OPENED') return 'Dialog opened';
  if (status === 'PREPARED') return 'Prepared';
  return 'Not printed';
}

function Stat({ label, value, warn }: { label: string; value?: number; warn?: boolean }) {
  return (
    <div className={`rounded-xl border bg-white p-3 ${warn ? 'border-amber-200' : ''}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 flex items-center gap-1 text-xl font-semibold">
        {warn ? (
          <AlertTriangle className="h-4 w-4 text-amber-600" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-sky-700" />
        )}
        {value ?? '…'}
      </p>
    </div>
  );
}

function Select({
  value,
  placeholder,
  onChange,
  children,
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <select
      className="h-10 rounded-md border bg-white px-3 text-sm"
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
