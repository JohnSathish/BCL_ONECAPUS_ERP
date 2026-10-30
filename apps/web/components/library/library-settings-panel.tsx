'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Settings } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  fetchBarcodeSettings,
  fetchKohaImportBatches,
  fetchLibrarySettings,
  fetchLibraryZoneOccupancy,
  fetchNextAccessionNo,
  saveBarcodeSettings,
  updateLibrarySettings,
  type LibraryBarcodeLabelSettings,
} from '@/services/library';
import type {
  CirculationPolicy,
  CategoryRulePolicy,
  FinePolicy,
  LibrarySettings,
  MemberRolePolicy,
} from '@/types/library';
import { apiErrorMessage } from '@/utils/api-error';

const TABS = [
  ['general', 'General'],
  ['circulation', 'Circulation Rules'],
  ['categories', 'Categories & Classification'],
  ['barcode', 'Barcode & Accession'],
  ['fines', 'Fine & Penalties'],
  ['digital', 'Digital Library'],
  ['notifications', 'Notifications'],
  ['import', 'Import & Migration'],
  ['other', 'Others'],
] as const;

const MIME_OPTIONS = [
  ['application/pdf', 'PDF'],
  ['application/epub+zip', 'EPUB'],
  ['application/msword', 'DOC'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'DOCX'],
  ['application/vnd.ms-powerpoint', 'PPT'],
  ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'PPTX'],
  ['image/jpeg', 'JPEG'],
  ['image/png', 'PNG'],
  ['image/webp', 'WEBP'],
  ['text/plain', 'TXT'],
  ['application/zip', 'ZIP'],
] as const;

const DEFAULT_CIRCULATION: CirculationPolicy = {
  student: { loanDays: 14, maxBooks: 3, maxRenewals: 1 },
  faculty: { loanDays: 30, maxBooks: 10, maxRenewals: 2 },
  researchScholar: { loanDays: 45, maxBooks: 15, maxRenewals: 2 },
  staff: { loanDays: 21, maxBooks: 5, maxRenewals: 1 },
  reference: { loanDays: 0, maxBooks: 0, allowIssue: false },
  rare: { loanDays: 7, maxBooks: 1, allowIssue: true, requireApproval: true },
};

const DEFAULT_FINE: FinePolicy = {
  lostBookPenaltyMultiplier: 2,
  damageChargeDefault: 100,
};

const ROLES = [
  ['student', 'Student'],
  ['faculty', 'Faculty'],
  ['researchScholar', 'Research Scholar'],
  ['staff', 'Staff'],
] as const;

type Tab = (typeof TABS)[number][0];

function safeNum(value: unknown, fallback = 0): number {
  if (value == null || value === '') return fallback;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function decimalInput(value: string | undefined | null): string {
  if (value == null) return '';
  const s = String(value);
  return s === 'NaN' ? '' : s;
}

function mergePolicy(raw?: CirculationPolicy): CirculationPolicy {
  if (!raw) return DEFAULT_CIRCULATION;
  const role = (key: keyof CirculationPolicy, base: MemberRolePolicy | CategoryRulePolicy) => {
    const patch = raw[key];
    if (!patch || typeof patch !== 'object') return base;
    return { ...base, ...patch };
  };
  return {
    student: role('student', DEFAULT_CIRCULATION.student) as MemberRolePolicy,
    faculty: role('faculty', DEFAULT_CIRCULATION.faculty) as MemberRolePolicy,
    researchScholar: role(
      'researchScholar',
      DEFAULT_CIRCULATION.researchScholar,
    ) as MemberRolePolicy,
    staff: role('staff', DEFAULT_CIRCULATION.staff) as MemberRolePolicy,
    reference: role('reference', DEFAULT_CIRCULATION.reference) as CategoryRulePolicy,
    rare: role('rare', DEFAULT_CIRCULATION.rare) as CategoryRulePolicy,
  };
}

function formFromSettings(s: LibrarySettings): Partial<LibrarySettings> {
  const storedMimes = s.allowedMimeTypes ?? [];
  return {
    totalSeats: safeNum(s.totalSeats, 200),
    finePerDay: decimalInput(s.finePerDay) || '0',
    graceDays: safeNum(s.graceDays),
    maxFine: decimalInput(s.maxFine) || '0',
    defaultLoanDays: safeNum(s.defaultLoanDays, 14),
    qrEntryEnabled: s.qrEntryEnabled ?? true,
    selfCheckInEnabled: s.selfCheckInEnabled ?? true,
    zonesEnabled: s.zonesEnabled ?? true,
    blockIssueOnUnpaidFines: s.blockIssueOnUnpaidFines ?? true,
    overdueNotifyEnabled: s.overdueNotifyEnabled ?? true,
    dueTomorrowNotifyEnabled: s.dueTomorrowNotifyEnabled ?? true,
    assistantEnabled: s.assistantEnabled ?? true,
    rfidEntryEnabled: s.rfidEntryEnabled ?? true,
    maxRenewals: safeNum(s.maxRenewals, 1),
    maxUploadMb: safeNum(s.maxUploadMb, 50),
    studentDigitalAccessEnabled: s.studentDigitalAccessEnabled ?? true,
    allowedMimeTypes: storedMimes.length ? storedMimes : MIME_OPTIONS.map(([mime]) => mime),
    accessionPrefix: s.accessionPrefix || 'ACC',
    accessionNextSeq: safeNum(s.accessionNextSeq, 1),
    updatedAt: s.updatedAt,
  };
}

function validate(form: Partial<LibrarySettings>, circulation: CirculationPolicy) {
  for (const [key, label] of ROLES) {
    const rule = circulation[key];
    if (rule.loanDays < 1) return `${label} loan days must be at least 1.`;
    if (rule.maxBooks < 0) return `${label} maximum books cannot be negative.`;
    if (rule.maxRenewals < 0) return `${label} maximum renewals cannot be negative.`;
  }
  if (circulation.rare.allowIssue && circulation.rare.loanDays < 1)
    return 'Rare-collection loan days must be at least 1 when borrowing is allowed.';
  if (circulation.reference.allowIssue && circulation.reference.loanDays < 1)
    return 'Reference loan days must be at least 1 when borrowing is allowed.';
  if (safeNum(form.finePerDay) < 0 || safeNum(form.maxFine) < 0)
    return 'Fine amounts cannot be negative.';
  if (safeNum(form.graceDays) < 0) return 'Grace days cannot be negative.';
  if (safeNum(form.totalSeats) < 1) return 'Seating capacity must be at least 1.';
  if (!form.accessionPrefix?.trim()) return 'Accession prefix is required.';
  if (safeNum(form.accessionNextSeq) < 1) return 'The next accession sequence must be at least 1.';
  if (safeNum(form.maxUploadMb) < 1) return 'The upload limit must be at least 1 MB.';
  if (!(form.allowedMimeTypes ?? []).length) return 'Choose at least one digital file type.';
  return '';
}

export function LibrarySettingsPanel() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('general');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState<Partial<LibrarySettings>>({});
  const [circulation, setCirculation] = useState<CirculationPolicy>(DEFAULT_CIRCULATION);
  const [finePolicy, setFinePolicy] = useState<FinePolicy>(DEFAULT_FINE);
  const [labels, setLabels] = useState<LibraryBarcodeLabelSettings | null>(null);
  const [baseline, setBaseline] = useState('');

  const settings = useQuery({
    queryKey: ['library', 'settings'],
    queryFn: fetchLibrarySettings,
    enabled,
  });
  const barcode = useQuery({
    queryKey: ['library', 'barcode-settings'],
    queryFn: fetchBarcodeSettings,
    enabled,
  });
  const nextAccession = useQuery({
    queryKey: ['library', 'accession-next'],
    queryFn: fetchNextAccessionNo,
    enabled,
  });
  const imports = useQuery({
    queryKey: ['library', 'koha-batches'],
    queryFn: fetchKohaImportBatches,
    enabled,
  });
  const zones = useQuery({
    queryKey: ['library', 'zones', 'occupancy'],
    queryFn: fetchLibraryZoneOccupancy,
    enabled,
  });

  useEffect(() => {
    if (!settings.data) return;
    const nextForm = formFromSettings(settings.data);
    const nextCirculation = mergePolicy(settings.data.circulationPolicy);
    const nextFine = {
      lostBookPenaltyMultiplier: safeNum(
        settings.data.finePolicy?.lostBookPenaltyMultiplier,
        DEFAULT_FINE.lostBookPenaltyMultiplier,
      ),
      damageChargeDefault: safeNum(
        settings.data.finePolicy?.damageChargeDefault,
        DEFAULT_FINE.damageChargeDefault,
      ),
    };
    setForm(nextForm);
    setCirculation(nextCirculation);
    setFinePolicy(nextFine);
    setBaseline(
      JSON.stringify({
        form: nextForm,
        circulation: nextCirculation,
        fine: nextFine,
        labels: barcode.data?.template ?? null,
      }),
    );
  }, [settings.data, barcode.data]);

  const snapshot = useMemo(
    () => JSON.stringify({ form, circulation, fine: finePolicy, labels }),
    [form, circulation, finePolicy, labels],
  );
  const dirty = Boolean(baseline) && snapshot !== baseline;

  useEffect(() => {
    if (barcode.data?.template) setLabels(barcode.data.template);
  }, [barcode.data]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const saved = await updateLibrarySettings({
        ...form,
        accessionPrefix: form.accessionPrefix?.trim(),
        circulationPolicy: circulation,
        finePolicy,
      });
      const labelBaseline = barcode.data?.template ? JSON.stringify(barcode.data.template) : '';
      if (labels && JSON.stringify(labels) !== labelBaseline) await saveBarcodeSettings(labels);
      return saved;
    },
    onSuccess: () => {
      setMessage(
        'Settings saved. New issues, renewals, fines, uploads, and labels use these values. Existing loans, fines, accession numbers, and barcodes are unchanged.',
      );
      void qc.invalidateQueries({ queryKey: ['library', 'settings'] });
      void qc.invalidateQueries({ queryKey: ['library', 'barcode-settings'] });
      void qc.invalidateQueries({ queryKey: ['library', 'accession-next'] });
    },
    onError: (error) => setMessage(apiErrorMessage(error)),
  });

  function save() {
    const problem = validate(form, circulation);
    if (problem) {
      setMessage(problem);
      return;
    }
    const saved = settings.data ? formFromSettings(settings.data) : form;
    const notes: string[] = [];
    if (
      saved.finePerDay !== form.finePerDay ||
      saved.graceDays !== form.graceDays ||
      saved.maxFine !== form.maxFine
    ) {
      notes.push(
        'Fine rates apply to assessments made after this save. Recorded fines and payments stay as they are.',
      );
    }
    if (
      JSON.stringify(mergePolicy(settings.data?.circulationPolicy)) !==
        JSON.stringify(circulation) ||
      saved.blockIssueOnUnpaidFines !== form.blockIssueOnUnpaidFines
    ) {
      notes.push('Borrowing limits apply the next time a book is issued or renewed.');
    }
    if (
      saved.accessionPrefix !== form.accessionPrefix ||
      saved.accessionNextSeq !== form.accessionNextSeq
    ) {
      notes.push(
        'Existing accession numbers and barcodes stay unchanged. The next new accession uses this prefix and sequence.',
      );
    }
    if (notes.length && !window.confirm(notes.join('\n\n'))) return;
    setMessage('');
    saveMut.mutate();
  }

  function reset() {
    if (!settings.data) return;
    setForm(formFromSettings(settings.data));
    setCirculation(mergePolicy(settings.data.circulationPolicy));
    setFinePolicy({
      lostBookPenaltyMultiplier: safeNum(
        settings.data.finePolicy?.lostBookPenaltyMultiplier,
        DEFAULT_FINE.lostBookPenaltyMultiplier,
      ),
      damageChargeDefault: safeNum(
        settings.data.finePolicy?.damageChargeDefault,
        DEFAULT_FINE.damageChargeDefault,
      ),
    });
    setLabels(barcode.data?.template ?? null);
    setMessage('Changes on this page were reset.');
  }

  if (settings.isLoading || !settings.data) {
    return <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />;
  }

  const year = new Date().getFullYear();
  const preview = `${form.accessionPrefix || 'ACC'}-${year}-${String(safeNum(form.accessionNextSeq, 1)).padStart(5, '0')}`;
  const latestImport = imports.data?.items?.[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">Library / Settings</p>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
            <Settings className="h-5 w-5 text-blue-600" />
            Library Settings
          </h1>
          <p className="text-sm text-slate-500">
            Configure library policies, circulation rules, barcode settings and system preferences
          </p>
          {dirty ? (
            <p className="mt-1 text-xs font-medium text-amber-700">Unsaved changes</p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={!dirty || saveMut.isPending} onClick={reset}>
            Reset
          </Button>
          <Button disabled={!dirty || saveMut.isPending} onClick={save}>
            {saveMut.isPending ? 'Saving…' : 'Save Settings'}
          </Button>
        </div>
      </div>
      {message ? (
        <p className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          {message}
        </p>
      ) : null}
      {settings.isError ? (
        <p className="text-sm text-destructive">{apiErrorMessage(settings.error)}</p>
      ) : null}

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm ${tab === key ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'general' ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card
            title="Library information"
            hint={
              labels?.preset === 'ZEBRA_2UP'
                ? 'Zebra stickers print this library code with the accession number and call number. The college name and logo stay off the label.'
                : 'The name on barcode labels. College contact details and the college logo stay on the institution profile.'
            }
          >
            {labels?.preset === 'ZEBRA_2UP' ? null : (
              <>
                <Field label="Name on labels">
                  <Input
                    value={labels?.headerTitle ?? ''}
                    onChange={(event) =>
                      setLabels(labels ? { ...labels, headerTitle: event.target.value } : labels)
                    }
                  />
                </Field>
                <Field label="Label subtitle">
                  <Input
                    value={labels?.headerSubtitle ?? ''}
                    onChange={(event) =>
                      setLabels(labels ? { ...labels, headerSubtitle: event.target.value } : labels)
                    }
                  />
                </Field>
              </>
            )}
            <Field label="Library code">
              <Input
                value={labels?.headerCode ?? ''}
                onChange={(event) =>
                  setLabels(labels ? { ...labels, headerCode: event.target.value } : labels)
                }
              />
            </Field>
            <p className="text-xs text-slate-500">
              {labels?.preset === 'ZEBRA_2UP'
                ? 'The college name and logo are not printed on this sticker.'
                : `Institution on the current label template: ${barcode.data?.institutionName || 'Loading…'}`}
            </p>
          </Card>
          <Card
            title="Seating and entry"
            hint="Seat count is the capacity used by reading-zone occupancy."
          >
            <Field label="Seats on record">
              <Input
                type="number"
                min={1}
                value={safeNum(form.totalSeats)}
                onChange={(event) =>
                  setForm({ ...form, totalSeats: safeNum(event.target.value, 1) })
                }
              />
            </Field>
            <Toggle
              label="QR entry"
              checked={Boolean(form.qrEntryEnabled)}
              onChange={(checked) => setForm({ ...form, qrEntryEnabled: checked })}
            />
            <Toggle
              label="RFID or barcode gate entry"
              checked={Boolean(form.rfidEntryEnabled)}
              onChange={(checked) => setForm({ ...form, rfidEntryEnabled: checked })}
            />
            <Toggle
              label="Student self check-in"
              checked={Boolean(form.selfCheckInEnabled)}
              onChange={(checked) => setForm({ ...form, selfCheckInEnabled: checked })}
            />
            <Toggle
              label="Reading zones"
              checked={Boolean(form.zonesEnabled)}
              onChange={(checked) => setForm({ ...form, zonesEnabled: checked })}
            />
            {zones.data?.length ? (
              <ul className="space-y-1 text-sm">
                {zones.data.map((zone) => (
                  <li key={zone.id} className="flex justify-between rounded-lg border px-3 py-2">
                    <span>{zone.name}</span>
                    <span>
                      {zone.occupied ?? 0}/{zone.totalSeats}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        </div>
      ) : null}

      {tab === 'circulation' ? (
        <Card
          title="Circulation rules by member type"
          hint="Student, faculty, and staff limits are applied at issue and renewal. Research scholar limits apply when a member is recorded as a research scholar. Loan days are calendar days. Due dates already on open loans stay as they are."
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  {['Member type', 'Loan days', 'Max books', 'Max renewals'].map((header) => (
                    <th key={header} className="px-2 py-2 font-medium">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROLES.map(([key, label]) => (
                  <tr key={key} className="border-t">
                    <td className="px-2 py-2 font-medium">{label}</td>
                    {(['loanDays', 'maxBooks', 'maxRenewals'] as const).map((field) => (
                      <td key={field} className="px-2 py-2">
                        <Input
                          type="number"
                          min={field === 'loanDays' ? 1 : 0}
                          className="w-24"
                          value={circulation[key][field]}
                          onChange={(event) =>
                            setCirculation({
                              ...circulation,
                              [key]: {
                                ...circulation[key],
                                [field]: safeNum(event.target.value, circulation[key][field]),
                              },
                            })
                          }
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Field label="Fallback renewals when a member type is set to 0">
            <Input
              type="number"
              min={0}
              className="w-28"
              value={safeNum(form.maxRenewals)}
              onChange={(event) => setForm({ ...form, maxRenewals: safeNum(event.target.value) })}
            />
          </Field>
          <Toggle
            label="Block a new issue when the member has an unpaid fine"
            checked={Boolean(form.blockIssueOnUnpaidFines)}
            onChange={(checked) => setForm({ ...form, blockIssueOnUnpaidFines: checked })}
          />
        </Card>
      ) : null}

      {tab === 'categories' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card
            title="Reference collection"
            hint="The issue desk blocks a reference copy when borrowing is off. Other catalogue categories keep their own records."
          >
            <Toggle
              label="Block issue for reference books"
              checked={!circulation.reference.allowIssue}
              onChange={(checked) =>
                setCirculation({
                  ...circulation,
                  reference: { ...circulation.reference, allowIssue: !checked },
                })
              }
            />
            {circulation.reference.allowIssue ? (
              <Field label="Reference loan days">
                <Input
                  type="number"
                  min={1}
                  className="w-28"
                  value={circulation.reference.loanDays}
                  onChange={(event) =>
                    setCirculation({
                      ...circulation,
                      reference: {
                        ...circulation.reference,
                        loanDays: safeNum(event.target.value, 1),
                      },
                    })
                  }
                />
              </Field>
            ) : (
              <p className="text-sm text-slate-500">
                Reference copies stay in the library for consultation.
              </p>
            )}
          </Card>
          <Card
            title="Rare collections"
            hint="Borrowing is blocked only when this switch is off. The approval flag is stored with the rule."
          >
            <Toggle
              label="Allow rare books to be issued"
              checked={circulation.rare.allowIssue}
              onChange={(checked) =>
                setCirculation({
                  ...circulation,
                  rare: { ...circulation.rare, allowIssue: checked },
                })
              }
            />
            <Field label="Loan days">
              <Input
                type="number"
                min={0}
                className="w-28"
                value={circulation.rare.loanDays}
                onChange={(event) =>
                  setCirculation({
                    ...circulation,
                    rare: { ...circulation.rare, loanDays: safeNum(event.target.value) },
                  })
                }
              />
            </Field>
            <Toggle
              label="Mark rare issues as requiring approval"
              checked={Boolean(circulation.rare.requireApproval)}
              onChange={(checked) =>
                setCirculation({
                  ...circulation,
                  rare: { ...circulation.rare, requireApproval: checked },
                })
              }
            />
          </Card>
        </div>
      ) : null}

      {tab === 'barcode' ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card
            title="Accession numbers"
            hint="Changing the prefix or the next sequence does not rewrite accession numbers already on copies."
          >
            <Field label="Prefix">
              <Input
                value={form.accessionPrefix ?? ''}
                onChange={(event) =>
                  setForm({ ...form, accessionPrefix: event.target.value.toUpperCase() })
                }
              />
            </Field>
            <Field label="Next sequence">
              <Input
                type="number"
                min={1}
                value={safeNum(form.accessionNextSeq, 1)}
                onChange={(event) =>
                  setForm({ ...form, accessionNextSeq: safeNum(event.target.value, 1) })
                }
              />
            </Field>
            <p className="text-sm text-slate-600">
              Next new accession: <span className="font-medium">{preview}</span>
            </p>
            <p className="text-xs text-slate-500">
              Saved next number: {nextAccession.data?.accessionNo ?? '…'}. Format is prefix, year,
              and a five-digit sequence. Barcode values stay on the copy and are printed as Code
              128.
            </p>
          </Card>
          <Card
            title="Barcode labels"
            hint={
              labels?.preset === 'ZEBRA_2UP'
                ? 'Zebra GT800 user-defined stock: 4.00 × 0.98 inch, two 50 mm labels. Size is set in Barcode Management.'
                : 'Sheet size and columns are edited in Barcode Management. These switches change the same label template.'
            }
          >
            {labels?.preset === 'ZEBRA_2UP' ? null : (
              <>
                <Toggle
                  label="Show the college logo"
                  checked={Boolean(labels?.showLogo)}
                  onChange={(checked) =>
                    setLabels(labels ? { ...labels, showLogo: checked } : labels)
                  }
                />
                <Toggle
                  label="Show title"
                  checked={Boolean(labels?.showTitle)}
                  onChange={(checked) =>
                    setLabels(labels ? { ...labels, showTitle: checked } : labels)
                  }
                />
              </>
            )}
            <Toggle
              label="Show accession number"
              checked={Boolean(labels?.showAccession)}
              onChange={(checked) =>
                setLabels(labels ? { ...labels, showAccession: checked } : labels)
              }
            />
            <p className="text-sm text-slate-600">
              {labels
                ? `${labels.preset.replace(/_/g, ' ')} · ${labels.labelWidthMm} × ${labels.labelHeightMm} mm · Code 128`
                : 'Loading the label template…'}
            </p>
            <Button asChild variant="outline">
              <Link href="/admin/library/barcodes">Open Barcode Management</Link>
            </Button>
          </Card>
        </div>
      ) : null}

      {tab === 'fines' ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card
            title="Overdue fines"
            hint="Fine = overdue days after the grace period × daily rate, capped at the maximum. Calendar days are used. Recorded fines are not recalculated."
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Fine per day (₹)">
                <Input
                  type="number"
                  min={0}
                  value={decimalInput(form.finePerDay)}
                  onChange={(event) => setForm({ ...form, finePerDay: event.target.value })}
                />
              </Field>
              <Field label="Grace days">
                <Input
                  type="number"
                  min={0}
                  value={safeNum(form.graceDays)}
                  onChange={(event) => setForm({ ...form, graceDays: safeNum(event.target.value) })}
                />
              </Field>
              <Field label="Maximum fine per book (₹)">
                <Input
                  type="number"
                  min={0}
                  value={decimalInput(form.maxFine)}
                  onChange={(event) => setForm({ ...form, maxFine: event.target.value })}
                />
              </Field>
            </div>
            <Toggle
              label="Block a new issue when a fine is unpaid"
              checked={Boolean(form.blockIssueOnUnpaidFines)}
              onChange={(checked) => setForm({ ...form, blockIssueOnUnpaidFines: checked })}
            />
          </Card>
          <Card
            title="Lost and damaged copies"
            hint="Recording an incident stores the charge. It does not collect the money or mark a fine paid."
          >
            <Field label="Lost-book charge (× copy price)">
              <Input
                type="number"
                min={0}
                step="0.1"
                value={finePolicy.lostBookPenaltyMultiplier}
                onChange={(event) =>
                  setFinePolicy({
                    ...finePolicy,
                    lostBookPenaltyMultiplier: safeNum(
                      event.target.value,
                      finePolicy.lostBookPenaltyMultiplier,
                    ),
                  })
                }
              />
            </Field>
            <Field label="Damage charge when no price is stored (₹)">
              <Input
                type="number"
                min={0}
                value={finePolicy.damageChargeDefault}
                onChange={(event) =>
                  setFinePolicy({
                    ...finePolicy,
                    damageChargeDefault: safeNum(
                      event.target.value,
                      finePolicy.damageChargeDefault,
                    ),
                  })
                }
              />
            </Field>
            <Button asChild variant="outline">
              <Link href="/admin/library/incidents">Open lost and damaged copies</Link>
            </Button>
          </Card>
        </div>
      ) : null}

      {tab === 'digital' ? (
        <Card
          title="Digital library"
          hint="Turning student access off hides published files from students. Uploaded files and download history stay in place."
        >
          <Toggle
            label="Students can open the digital library"
            checked={Boolean(form.studentDigitalAccessEnabled)}
            onChange={(checked) => setForm({ ...form, studentDigitalAccessEnabled: checked })}
          />
          <Field label="Maximum upload (MB)">
            <Input
              type="number"
              min={1}
              className="w-28"
              value={safeNum(form.maxUploadMb, 50)}
              onChange={(event) =>
                setForm({ ...form, maxUploadMb: safeNum(event.target.value, 1) })
              }
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            {MIME_OPTIONS.map(([mime, label]) => {
              const selected = (form.allowedMimeTypes ?? []).includes(mime);
              return (
                <button
                  key={mime}
                  type="button"
                  className={`rounded-full border px-3 py-1 text-sm ${selected ? 'border-blue-600 bg-blue-50 text-blue-700' : 'text-slate-600'}`}
                  onClick={() => {
                    const current = form.allowedMimeTypes ?? [];
                    setForm({
                      ...form,
                      allowedMimeTypes: selected
                        ? current.filter((item) => item !== mime)
                        : [...current, mime],
                    });
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-slate-500">
            The server checks the file type and size before a file is stored. New uploads stay in
            draft until they are published.
          </p>
        </Card>
      ) : null}

      {tab === 'notifications' ? (
        <Card
          title="Email reminders"
          hint="These reminders use the library email already configured for the college. A channel that is not set up is not offered here."
        >
          <Toggle
            label="Send a reminder on the day before a book is due"
            checked={Boolean(form.dueTomorrowNotifyEnabled)}
            onChange={(checked) => setForm({ ...form, dueTomorrowNotifyEnabled: checked })}
          />
          <Toggle
            label="Send overdue reminders"
            checked={Boolean(form.overdueNotifyEnabled)}
            onChange={(checked) => setForm({ ...form, overdueNotifyEnabled: checked })}
          />
          <p className="text-sm text-slate-500">
            Reservation-ready mail is sent when a held copy becomes available. Lost and damaged
            notices are sent from the incidents desk.
          </p>
        </Card>
      ) : null}

      {tab === 'import' ? (
        <Card
          title="Koha catalogue import"
          hint="Import keeps accession numbers, barcodes, and collection codes. Repeating an import does not create a second copy of a record that was already brought in."
        >
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/admin/library/koha-import">Import from Koha</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/library/koha-import">View import history</Link>
            </Button>
          </div>
          {latestImport ? (
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <Info label="Latest import" value={latestImport.importName} />
              <Info label="Status" value={latestImport.status} />
              <Info label="Titles imported" value={String(latestImport.importedBooks ?? 0)} />
              <Info label="Copies imported" value={String(latestImport.importedCopies ?? 0)} />
              <Info label="Failed records" value={String(latestImport.failedRecords ?? 0)} />
              <Info label="Needs review" value={String(latestImport.needsReview ?? 0)} />
            </dl>
          ) : (
            <p className="text-sm text-slate-500">
              {imports.isLoading
                ? 'Loading import history…'
                : 'No Koha import has been recorded for this library.'}
            </p>
          )}
        </Card>
      ) : null}

      {tab === 'other' ? (
        <Card
          title="Other library preferences"
          hint="Only switches that the library services already read are listed here."
        >
          <Toggle
            label="Library knowledge assistant"
            checked={Boolean(form.assistantEnabled)}
            onChange={(checked) => setForm({ ...form, assistantEnabled: checked })}
          />
          <p className="text-sm text-slate-500">
            Due dates use calendar days plus the grace period. A separate holiday calendar is not
            applied to fines or due dates. Floor area and opening hours are not stored on the
            library settings.
          </p>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <BookOpen className="h-4 w-4" />
            Reports, accession, and barcode pages keep their own export and print actions.
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h2 className="font-semibold text-slate-900">{title}</h2>
        {hint ? <p className="text-sm text-slate-500">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm text-slate-600">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  );
}
