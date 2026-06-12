'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Eye, FileSpreadsheet, History, Search, Wand2 } from 'lucide-react';

import {
  BulkActionButton,
  BulkActionToolbar,
  BulkEmptyState,
  BulkWorkflowStepper,
  ResetAction,
  SpreadsheetDropzone,
  TemplateDownloadAction,
} from '@/components/erp/bulk-actions';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button, buttonVariants } from '@/components/ui/button';
import { useRequireAuth } from '@/hooks/use-auth';
import { useStaffPermissions } from '@/hooks/use-staff-permissions';
import { fetchDepartments } from '@/services/organization';
import { fetchDesignations, fetchStaff } from '@/services/staff';
import { fetchShifts } from '@/services/shifts';
import {
  applyStaffBulkUpdate,
  downloadStaffBulkUpdateErrorReport,
  downloadStaffBulkUpdateTemplate,
  fetchStaffBulkUpdateBatches,
  fetchStaffBulkUpdateFields,
  formatStaffBulkValue,
  previewStaffBulkUpdate,
  rollbackStaffBulkUpdate,
  type StaffBulkUpdateFieldDef,
  type StaffBulkUpdateMatchingKey,
  type StaffBulkUpdatePreviewResult,
  uploadStaffBulkUpdatePreview,
} from '@/services/staff-bulk-update';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

type Step = 'mode' | 'fields' | 'data' | 'validate' | 'preview' | 'commit';
type UpdateMode = 'spreadsheet' | 'inline';

const STEPS: { key: Step; label: string }[] = [
  { key: 'mode', label: 'Select Update Mode' },
  { key: 'fields', label: 'Choose Fields' },
  { key: 'data', label: 'Upload / Manual Edit' },
  { key: 'validate', label: 'Validate' },
  { key: 'preview', label: 'Preview Changes' },
  { key: 'commit', label: 'Commit Update' },
];

const MATCHING_KEYS: { id: StaffBulkUpdateMatchingKey; label: string }[] = [
  { id: 'employeeCode', label: 'Staff Code / Employee Code' },
  { id: 'shortCode', label: 'Current Short Code' },
  { id: 'portalEmail', label: 'Portal Email' },
  { id: 'staffId', label: 'Internal Staff ID' },
];

const MATCHING_FIELD_CONFLICTS: Partial<Record<StaffBulkUpdateMatchingKey, string>> = {
  employeeCode: 'employeeCode',
  shortCode: 'shortCode',
  portalEmail: 'portalEmail',
};

function safeMatchingKey(
  selectedFields: string[],
  current: StaffBulkUpdateMatchingKey,
): StaffBulkUpdateMatchingKey {
  const matchingField = MATCHING_FIELD_CONFLICTS[current];
  if (matchingField && selectedFields.includes(matchingField)) {
    return selectedFields.includes('employeeCode') ? 'staffId' : 'employeeCode';
  }
  return current;
}

export function StaffBulkUpdatePage() {
  const session = useRequireAuth();
  const perms = useStaffPermissions();
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>('mode');
  const [mode, setMode] = useState<UpdateMode>('spreadsheet');
  const [matchingKey, setMatchingKey] = useState<StaffBulkUpdateMatchingKey>('employeeCode');
  const [fieldKeys, setFieldKeys] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [inlineRows, setInlineRows] = useState<Record<string, string>[]>([]);
  const [preview, setPreview] = useState<StaffBulkUpdatePreviewResult | null>(null);
  const [forceApply, setForceApply] = useState(false);
  const [message, setMessage] = useState('');
  const [quickField, setQuickField] = useState('');
  const [quickValue, setQuickValue] = useState('');
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [templateGenerating, setTemplateGenerating] = useState(false);
  const [templateReady, setTemplateReady] = useState(false);
  const [templateFilters, setTemplateFilters] = useState({
    staffType: '',
    departmentId: '',
    designationId: '',
    shiftId: '',
    status: 'ACTIVE',
  });

  const fields = useQuery({
    queryKey: ['staff-bulk-update', 'fields'],
    queryFn: fetchStaffBulkUpdateFields,
    enabled: Boolean(session) && perms.canBulkUpdate,
  });
  const staffRows = useQuery({
    queryKey: ['staff-bulk-update', 'staff-sample'],
    queryFn: () => fetchStaff({ page: 1, limit: 100 }),
    enabled: Boolean(session) && perms.canBulkUpdate && mode === 'inline',
  });
  const departments = useQuery({
    queryKey: ['org', 'departments', 'staff-bulk-update'],
    queryFn: () => fetchDepartments(),
    enabled: Boolean(session),
  });
  const designations = useQuery({
    queryKey: ['staff', 'designations', 'bulk-update'],
    queryFn: () => fetchDesignations(),
    enabled: Boolean(session),
  });
  const shifts = useQuery({
    queryKey: ['shifts', 'staff-bulk-update'],
    queryFn: () => fetchShifts({ status: 'ACTIVE' }),
    enabled: Boolean(session),
  });
  const batches = useQuery({
    queryKey: ['staff-bulk-update', 'batches'],
    queryFn: fetchStaffBulkUpdateBatches,
    enabled: Boolean(session) && perms.canBulkUpdate,
  });

  const flatFields = useMemo(
    () => (fields.data ?? []).flatMap((group) => group.fields),
    [fields.data],
  );
  const selectedFields = flatFields.filter((field) => fieldKeys.includes(field.fieldKey));
  const stepIndex = STEPS.findIndex((s) => s.key === step);

  useEffect(() => {
    const safe = safeMatchingKey(fieldKeys, matchingKey);
    if (safe !== matchingKey) setMatchingKey(safe);
  }, [fieldKeys, matchingKey]);

  useEffect(() => {
    if (mode !== 'inline' || !staffRows.data?.data.length || inlineRows.length > 0) return;
    setInlineRows(
      staffRows.data.data.map((row) => ({
        employeeCode: row.employeeCode,
        shortCode: row.shortCode ?? '',
        portalEmail: row.email ?? '',
        staffId: row.id,
        fullName: row.fullName,
        mobile: row.mobile ?? '',
        email: row.email ?? '',
        shortCodeValue: row.shortCode ?? '',
        departmentId: row.departmentId ?? '',
        designationId: row.designationId ?? '',
        primaryShiftId: row.primaryShiftId ?? '',
        staffType: String(row.staffType ?? ''),
        status: String(row.status ?? ''),
        rfidNo: row.rfidNo ?? '',
      })),
    );
  }, [mode, staffRows.data, inlineRows.length]);

  const previewMut = useMutation({
    mutationFn: async () => {
      if (mode === 'spreadsheet') {
        if (!file) throw new Error('Upload an Excel or CSV file before validation.');
        return uploadStaffBulkUpdatePreview(
          file,
          fieldKeys,
          safeMatchingKey(fieldKeys, matchingKey),
        );
      }
      const effectiveMatchingKey = safeMatchingKey(fieldKeys, matchingKey);
      return previewStaffBulkUpdate({
        scope: {},
        fieldKeys,
        updateMode: 'CSV',
        matchingKey: effectiveMatchingKey,
        csvRows: inlineRows.map((row) => {
          const out: Record<string, string> = {
            [effectiveMatchingKey]: row[effectiveMatchingKey] ?? row.employeeCode,
          };
          for (const field of fieldKeys) {
            out[field] = row[field] ?? '';
          }
          return out;
        }),
      });
    },
    onSuccess: (data) => {
      setPreview(data);
      setMessage('');
      setStep('preview');
    },
    onError: (error) => setMessage(apiErrorMessage(error, 'Validation failed')),
  });

  const applyMut = useMutation({
    mutationFn: () => {
      if (!preview?.batchId) throw new Error('Generate preview before commit.');
      return applyStaffBulkUpdate(preview.batchId, forceApply);
    },
    onSuccess: (result) => {
      setMessage(result.message ?? `Updated ${result.applied ?? 0} staff records.`);
      void qc.invalidateQueries({ queryKey: ['staff'] });
      void qc.invalidateQueries({ queryKey: ['staff-bulk-update', 'batches'] });
      setStep('commit');
    },
    onError: (error) => setMessage(apiErrorMessage(error, 'Commit failed')),
  });

  const rollbackMut = useMutation({
    mutationFn: rollbackStaffBulkUpdate,
    onSuccess: (result) => {
      setMessage(`Rolled back ${result.rolledBackStaff} staff records.`);
      void qc.invalidateQueries({ queryKey: ['staff-bulk-update', 'batches'] });
      void qc.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: (error) => setMessage(apiErrorMessage(error, 'Rollback failed')),
  });

  if (!session) return null;

  if (!perms.canBulkUpdate) {
    return (
      <DashboardShell role="admin" title="Staff Bulk Update">
        <p className="text-sm text-muted-foreground">
          You do not have permission to bulk update staff.
        </p>
      </DashboardShell>
    );
  }

  const nextDisabled =
    (step === 'fields' && fieldKeys.length === 0) ||
    (step === 'data' && mode === 'spreadsheet' && !file) ||
    (step === 'data' && mode === 'inline' && inlineRows.length === 0) ||
    step === 'preview' ||
    step === 'commit';

  const goNext = () => {
    if (step === 'data' || step === 'validate') {
      previewMut.mutate();
      return;
    }
    const next = STEPS[Math.min(stepIndex + 1, STEPS.length - 1)]?.key;
    if (next) setStep(next);
  };

  const resetTemplateFilters = () => {
    setTemplateFilters({
      staffType: '',
      departmentId: '',
      designationId: '',
      shiftId: '',
      status: 'ACTIVE',
    });
    setTemplateReady(false);
  };

  const handleTemplateDownload = async () => {
    setTemplateGenerating(true);
    setTemplateReady(false);
    try {
      await downloadStaffBulkUpdateTemplate(fieldKeys, safeMatchingKey(fieldKeys, matchingKey), {
        staffType: templateFilters.staffType || undefined,
        departmentId: templateFilters.departmentId || undefined,
        designationId: templateFilters.designationId || undefined,
        shiftId: templateFilters.shiftId || undefined,
        status: templateFilters.status || undefined,
      });
      setTemplateReady(true);
      window.setTimeout(() => setTemplateReady(false), 2500);
    } finally {
      setTemplateGenerating(false);
    }
  };

  return (
    <DashboardShell role="admin" title="Staff Bulk Update Studio">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Link
            href="/admin/staff"
            className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-1 h-3.5 w-3.5" />
            Staff Directory
          </Link>
          <p className="text-xs text-muted-foreground">
            Update selected staff columns through generated templates or an editable grid with
            validation and rollback.
          </p>
        </div>
        <BulkActionToolbar>
          <TemplateDownloadAction
            disabled={fieldKeys.length === 0}
            loading={templateGenerating}
            ready={templateReady}
            onClick={() => void handleTemplateDownload()}
          />
          <BulkActionButton
            type="button"
            variant="outline"
            size="sm"
            icon={<Eye className="h-4 w-4" />}
            onClick={() =>
              setMessage(
                'Sample: choose fields, apply filters, download template, fill only New value columns, upload, validate, and commit.',
              )
            }
          >
            View Sample
          </BulkActionButton>
          <ResetAction onClick={resetTemplateFilters} />
        </BulkActionToolbar>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
        <div className="glass-card rounded-xl border border-border/60 p-4">
          <BulkWorkflowStepper steps={STEPS} current={Math.max(0, stepIndex)} />
          <div className="mt-5">
            {fieldKeys.length === 0 && step === 'mode' ? (
              <BulkEmptyState
                title="No template generated yet"
                description="Prepare a safe bulk update by choosing columns first, then generating an assisted Excel template."
                steps={[
                  'Choose fields',
                  'Apply filters',
                  'Generate template',
                  'Upload edited sheet',
                ]}
              />
            ) : null}
            {step === 'mode' ? <ModeStep mode={mode} onChange={setMode} /> : null}
            {step === 'fields' ? (
              <FieldStep
                groups={fields.data ?? []}
                selected={fieldKeys}
                search={search}
                onSearch={setSearch}
                onChange={setFieldKeys}
              />
            ) : null}
            {step === 'data' || step === 'validate' ? (
              <DataStep
                mode={mode}
                matchingKey={matchingKey}
                onMatchingKeyChange={setMatchingKey}
                fields={selectedFields}
                file={file}
                onFile={setFile}
                rows={inlineRows}
                onRows={setInlineRows}
                lookupOptions={{
                  departmentId: (departments.data ?? []).map((d) => ({ id: d.id, label: d.name })),
                  designationId: (designations.data ?? []).map((d) => ({
                    id: d.id,
                    label: d.label,
                  })),
                  primaryShiftId: (shifts.data ?? []).map((s) => ({ id: s.id, label: s.name })),
                }}
                quickField={quickField}
                quickValue={quickValue}
                findText={findText}
                replaceText={replaceText}
                onQuickField={setQuickField}
                onQuickValue={setQuickValue}
                onFindText={setFindText}
                onReplaceText={setReplaceText}
                templateFilters={templateFilters}
                onTemplateFilters={setTemplateFilters}
                uploadLoading={previewMut.isPending}
              />
            ) : null}
            {step === 'preview' ? (
              <PreviewStep
                preview={preview}
                forceApply={forceApply}
                onForceApply={setForceApply}
                onDownloadErrorReport={() =>
                  preview?.batchId
                    ? void downloadStaffBulkUpdateErrorReport(preview.batchId)
                    : undefined
                }
              />
            ) : null}
            {step === 'commit' ? (
              <CommitStep
                message={message}
                batches={batches.data ?? []}
                canRollback={perms.canBulkUpdateRollback}
                onRollback={(batchId) => rollbackMut.mutate(batchId)}
              />
            ) : null}
          </div>

          {message && step !== 'commit' ? (
            <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700">
              {message}
            </p>
          ) : null}

          <div className="mt-5 flex justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={stepIndex === 0 || previewMut.isPending || applyMut.isPending}
              onClick={() => setStep(STEPS[Math.max(stepIndex - 1, 0)]!.key)}
            >
              Back
            </Button>
            {step === 'preview' ? (
              <BulkActionButton
                type="button"
                size="sm"
                elevated
                disabled={!preview || (preview.invalid > 0 && !forceApply) || applyMut.isPending}
                loading={applyMut.isPending}
                loadingText="Committing..."
                onClick={() => applyMut.mutate()}
              >
                {`Commit ${preview?.valid ?? 0} staff updates`}
              </BulkActionButton>
            ) : step === 'commit' ? (
              <Link href="/admin/staff" className={cn(buttonVariants({ size: 'sm' }), 'text-xs')}>
                Back to Directory
              </Link>
            ) : (
              <BulkActionButton
                type="button"
                size="lg"
                elevated
                disabled={nextDisabled || previewMut.isPending}
                loading={previewMut.isPending}
                loadingText="Validating..."
                icon={
                  step === 'data' || step === 'validate' ? (
                    <Search className="h-4 w-4" />
                  ) : undefined
                }
                onClick={goNext}
                className={step === 'data' || step === 'validate' ? 'px-5' : undefined}
              >
                {step === 'data' || step === 'validate' ? 'Validate & Preview Changes' : 'Next'}
              </BulkActionButton>
            )}
          </div>
        </div>

        <SummarySidebar
          mode={mode}
          matchingKey={matchingKey}
          selectedFields={selectedFields}
          preview={preview}
          batches={batches.data ?? []}
        />
      </div>
    </DashboardShell>
  );
}

function ModeStep({ mode, onChange }: { mode: UpdateMode; onChange: (mode: UpdateMode) => void }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {[
        {
          id: 'spreadsheet' as const,
          title: 'Spreadsheet Import',
          body: 'Upload XLSX, XLS, or CSV. Best for 100+ staff records.',
        },
        {
          id: 'inline' as const,
          title: 'Inline Table Update',
          body: 'Edit a spreadsheet-like grid in the browser. Best for small corrections.',
        },
      ].map((option) => (
        <button
          key={option.id}
          type="button"
          className={cn(
            'rounded-xl border p-4 text-left transition hover:bg-muted/30',
            mode === option.id ? 'border-primary bg-primary/5' : 'border-border',
          )}
          onClick={() => onChange(option.id)}
        >
          <FileSpreadsheet className="mb-3 h-5 w-5 text-primary" />
          <h2 className="text-sm font-semibold">{option.title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{option.body}</p>
        </button>
      ))}
    </div>
  );
}

function FieldStep({
  groups,
  selected,
  search,
  onSearch,
  onChange,
}: {
  groups: { group: string; fields: StaffBulkUpdateFieldDef[] }[];
  selected: string[];
  search: string;
  onSearch: (value: string) => void;
  onChange: (keys: string[]) => void;
}) {
  const q = search.trim().toLowerCase();
  const filtered = groups
    .map((group) => ({
      ...group,
      fields: group.fields.filter(
        (field) =>
          !q || field.label.toLowerCase().includes(q) || field.fieldKey.toLowerCase().includes(q),
      ),
    }))
    .filter((group) => group.fields.length > 0);
  const toggle = (fieldKey: string) =>
    onChange(
      selected.includes(fieldKey)
        ? selected.filter((key) => key !== fieldKey)
        : [...selected, fieldKey],
    );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Choose target fields</h2>
        <p className="text-xs text-muted-foreground">
          Only selected fields appear in the generated template and editor.
        </p>
      </div>
      <input
        type="search"
        placeholder="Search fields..."
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs"
        value={search}
        onChange={(event) => onSearch(event.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        {[
          ['Contact', ['mobile', 'email', 'shortCode']],
          ['Device IDs', ['rfidNo', 'biometricId']],
          ['Employment', ['departmentId', 'designationId', 'primaryShiftId', 'status']],
        ].map(([label, keys]) => (
          <button
            key={label as string}
            type="button"
            className="rounded-full border border-border px-2.5 py-1 text-[11px] hover:bg-muted"
            onClick={() => onChange([...new Set([...selected, ...(keys as string[])])])}
          >
            {label as string}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {filtered.map((group) => (
          <section key={group.group} className="rounded-lg border border-border p-3">
            <h3 className="mb-2 text-xs font-semibold">{group.group}</h3>
            <div className="grid gap-2 md:grid-cols-3">
              {group.fields.map((field) => (
                <label
                  key={field.fieldKey}
                  className="flex items-start gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted/40"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(field.fieldKey)}
                    onChange={() => toggle(field.fieldKey)}
                  />
                  <span>
                    <span className="font-medium">{field.label}</span>
                    {field.supportsAppend ? (
                      <span className="ml-1 text-[10px] text-muted-foreground">append</span>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function DataStep(props: {
  mode: UpdateMode;
  matchingKey: StaffBulkUpdateMatchingKey;
  onMatchingKeyChange: (key: StaffBulkUpdateMatchingKey) => void;
  fields: StaffBulkUpdateFieldDef[];
  file: File | null;
  onFile: (file: File | null) => void;
  rows: Record<string, string>[];
  onRows: (rows: Record<string, string>[]) => void;
  lookupOptions: Record<string, { id: string; label: string }[]>;
  quickField: string;
  quickValue: string;
  findText: string;
  replaceText: string;
  onQuickField: (value: string) => void;
  onQuickValue: (value: string) => void;
  onFindText: (value: string) => void;
  onReplaceText: (value: string) => void;
  templateFilters: {
    staffType: string;
    departmentId: string;
    designationId: string;
    shiftId: string;
    status: string;
  };
  onTemplateFilters: (value: {
    staffType: string;
    departmentId: string;
    designationId: string;
    shiftId: string;
    status: string;
  }) => void;
  uploadLoading: boolean;
}) {
  const applySameValue = () => {
    if (!props.quickField) return;
    props.onRows(props.rows.map((row) => ({ ...row, [props.quickField]: props.quickValue })));
  };
  const applyFindReplace = () => {
    if (!props.quickField || !props.findText) return;
    props.onRows(
      props.rows.map((row) => ({
        ...row,
        [props.quickField]: String(row[props.quickField] ?? '').replaceAll(
          props.findText,
          props.replaceText,
        ),
      })),
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-xs">
          <span className="font-medium">Matching method</span>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
            value={props.matchingKey}
            onChange={(event) =>
              props.onMatchingKeyChange(event.target.value as StaffBulkUpdateMatchingKey)
            }
          >
            {MATCHING_KEYS.map((key) => {
              const conflictsWithUpdate = props.fields.some(
                (field) => MATCHING_FIELD_CONFLICTS[key.id] === field.fieldKey,
              );
              return (
                <option key={key.id} value={key.id} disabled={conflictsWithUpdate}>
                  {key.label}
                  {conflictsWithUpdate ? ' (selected for update)' : ''}
                </option>
              );
            })}
          </select>
          {props.fields.some(
            (field) => MATCHING_FIELD_CONFLICTS[props.matchingKey] === field.fieldKey,
          ) ? (
            <span className="text-[11px] text-amber-600">
              Matching key changed automatically because the same field is selected for update.
            </span>
          ) : null}
        </label>
      </div>

      <div className="rounded-xl border border-border p-3">
        <h2 className="text-sm font-semibold">Template staff filter</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Downloaded templates are prefilled from the database using these filters.
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-5">
          <TemplateSelect
            label="Type"
            value={props.templateFilters.staffType}
            options={[
              { id: 'TEACHING', label: 'Teaching' },
              { id: 'NON_TEACHING', label: 'Non-Teaching' },
              { id: 'GUEST', label: 'Guest / Visiting' },
            ]}
            onChange={(staffType) =>
              props.onTemplateFilters({ ...props.templateFilters, staffType })
            }
          />
          <TemplateSelect
            label="Department"
            value={props.templateFilters.departmentId}
            options={props.lookupOptions.departmentId ?? []}
            onChange={(departmentId) =>
              props.onTemplateFilters({ ...props.templateFilters, departmentId })
            }
          />
          <TemplateSelect
            label="Designation"
            value={props.templateFilters.designationId}
            options={props.lookupOptions.designationId ?? []}
            onChange={(designationId) =>
              props.onTemplateFilters({ ...props.templateFilters, designationId })
            }
          />
          <TemplateSelect
            label="Shift"
            value={props.templateFilters.shiftId}
            options={props.lookupOptions.primaryShiftId ?? []}
            onChange={(shiftId) => props.onTemplateFilters({ ...props.templateFilters, shiftId })}
          />
          <TemplateSelect
            label="Status"
            value={props.templateFilters.status}
            options={[
              { id: 'ACTIVE', label: 'Active' },
              { id: 'ON_LEAVE', label: 'On Leave' },
              { id: 'RETIRED', label: 'Retired' },
              { id: 'RELIEVED', label: 'Relieved' },
            ]}
            onChange={(status) => props.onTemplateFilters({ ...props.templateFilters, status })}
          />
        </div>
      </div>

      {props.mode === 'spreadsheet' ? (
        <SpreadsheetDropzone
          file={props.file}
          loading={props.uploadLoading}
          title="Drag & Drop Excel / CSV File"
          subtitle="or click to browse the edited staff template"
          supportedText="XLSX • XLS • CSV"
          onFile={props.onFile}
          onRemove={() => props.onFile(null)}
        />
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border border-border p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold">
              <Wand2 className="h-4 w-4" />
              Quick operations
            </div>
            <div className="grid gap-2 md:grid-cols-5">
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                value={props.quickField}
                onChange={(e) => props.onQuickField(e.target.value)}
              >
                <option value="">Field</option>
                {props.fields.map((field) => (
                  <option key={field.fieldKey} value={field.fieldKey}>
                    {field.label}
                  </option>
                ))}
              </select>
              <input
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                placeholder="Same value"
                value={props.quickValue}
                onChange={(e) => props.onQuickValue(e.target.value)}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={applySameValue}
              >
                Set same value
              </Button>
              <input
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                placeholder="Find"
                value={props.findText}
                onChange={(e) => props.onFindText(e.target.value)}
              />
              <div className="flex gap-2">
                <input
                  className="h-8 min-w-0 rounded-md border border-input bg-background px-2 text-xs"
                  placeholder="Replace"
                  value={props.replaceText}
                  onChange={(e) => props.onReplaceText(e.target.value)}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={applyFindReplace}
                >
                  Replace
                </Button>
              </div>
            </div>
          </div>
          <InlineGrid {...props} />
        </div>
      )}
    </div>
  );
}

function InlineGrid({
  fields,
  rows,
  onRows,
  lookupOptions,
}: {
  fields: StaffBulkUpdateFieldDef[];
  rows: Record<string, string>[];
  onRows: (rows: Record<string, string>[]) => void;
  lookupOptions: Record<string, { id: string; label: string }[]>;
}) {
  const setCell = (index: number, key: string, value: string) => {
    onRows(rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  };
  return (
    <div className="max-h-[520px] overflow-auto rounded-lg border border-border">
      <table className="min-w-full text-xs">
        <thead className="sticky top-0 bg-muted/80 text-left backdrop-blur">
          <tr>
            <th className="px-2 py-2">Employee Code</th>
            <th className="px-2 py-2">Staff</th>
            {fields.map((field) => (
              <th key={field.fieldKey} className="px-2 py-2">
                {field.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.staffId ?? row.employeeCode} className="border-t border-border/60">
              <td className="whitespace-nowrap px-2 py-2 font-mono">{row.employeeCode}</td>
              <td className="min-w-48 px-2 py-2">{row.fullName}</td>
              {fields.map((field) => (
                <td key={field.fieldKey} className="min-w-44 px-2 py-1">
                  {lookupOptions[field.fieldKey]?.length ? (
                    <select
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                      value={row[field.fieldKey] ?? ''}
                      onChange={(event) => setCell(index, field.fieldKey, event.target.value)}
                    >
                      <option value="">Select...</option>
                      {lookupOptions[field.fieldKey].map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                      value={row[field.fieldKey] ?? ''}
                      onChange={(event) => setCell(index, field.fieldKey, event.target.value)}
                    />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TemplateSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1 text-xs">
      <span className="font-medium">{label}</span>
      <select
        className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function PreviewStep({
  preview,
  forceApply,
  onForceApply,
  onDownloadErrorReport,
}: {
  preview: StaffBulkUpdatePreviewResult | null;
  forceApply: boolean;
  onForceApply: (value: boolean) => void;
  onDownloadErrorReport: () => void;
}) {
  if (!preview)
    return <p className="text-sm text-muted-foreground">Run validation to generate preview.</p>;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <Stat label="Rows uploaded" value={preview.total} />
        <Stat label="Matched / valid" value={preview.valid} tone="ok" />
        <Stat label="Warnings / skipped" value={preview.skipped} />
        <Stat label="Errors" value={preview.invalid} tone={preview.invalid ? 'bad' : undefined} />
      </div>
      {preview.invalid > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={forceApply}
              onChange={(event) => onForceApply(event.target.checked)}
            />
            Force commit valid changes even when some rows failed
          </label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={onDownloadErrorReport}
          >
            Download Error Report
          </Button>
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-2 py-2">Staff</th>
              <th className="px-2 py-2">Before {'->'} After</th>
              <th className="px-2 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row) => (
              <tr key={row.staffId} className="border-t border-border/60 align-top">
                <td className="px-2 py-2">
                  <div className="font-medium">{row.fullName}</div>
                  <div className="font-mono text-muted-foreground">{row.employeeCode}</div>
                </td>
                <td className="px-2 py-2">
                  {row.changes.length ? (
                    <ul className="space-y-1">
                      {row.changes.map((change) => (
                        <li key={change.fieldKey}>
                          <span className="font-medium">{change.label}:</span>{' '}
                          <span className="text-muted-foreground line-through">
                            {formatStaffBulkValue(change.before)}
                          </span>
                          {' -> '}
                          <span>{formatStaffBulkValue(change.after)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-muted-foreground">No changed values</span>
                  )}
                </td>
                <td className="px-2 py-2">
                  {row.errors.length ? (
                    <ul className="space-y-1 text-destructive">
                      {row.errors.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  ) : row.warnings?.length ? (
                    <ul className="space-y-1 text-amber-600">
                      {row.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-emerald-600">Ready</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CommitStep({
  message,
  batches,
  canRollback,
  onRollback,
}: {
  message: string;
  batches: {
    id: string;
    status: string;
    staffCount: number;
    appliedCount: number;
    errorCount: number;
    createdAt: string;
    fieldKeys: string[];
  }[];
  canRollback: boolean;
  onRollback: (batchId: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
        <h2 className="text-sm font-semibold">Bulk update completed</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {message || 'The batch has been committed.'}
        </p>
      </div>
      <section className="rounded-lg border border-border p-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold">
          <History className="h-4 w-4" />
          Recent Bulk Update History
        </div>
        <div className="space-y-2">
          {batches.slice(0, 5).map((batch) => (
            <div
              key={batch.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/30 px-2 py-2 text-xs"
            >
              <span>
                <span className="font-medium">{batch.status}</span> · {batch.staffCount} staff ·{' '}
                {batch.fieldKeys.join(', ')}
              </span>
              {canRollback && batch.status === 'APPLIED' ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => onRollback(batch.id)}
                >
                  Rollback 24h
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SummarySidebar({
  mode,
  matchingKey,
  selectedFields,
  preview,
  batches,
}: {
  mode: UpdateMode;
  matchingKey: StaffBulkUpdateMatchingKey;
  selectedFields: StaffBulkUpdateFieldDef[];
  preview: StaffBulkUpdatePreviewResult | null;
  batches: { id: string; status: string }[];
}) {
  return (
    <aside className="glass-card h-fit rounded-xl border border-border/60 p-4 text-xs">
      <h2 className="text-sm font-semibold">Summary</h2>
      <dl className="mt-3 space-y-2">
        <Row label="Mode" value={mode === 'spreadsheet' ? 'Spreadsheet Import' : 'Inline Table'} />
        <Row
          label="Matching Key"
          value={MATCHING_KEYS.find((key) => key.id === matchingKey)?.label ?? matchingKey}
        />
        <Row label="Selected Fields" value={String(selectedFields.length)} />
        <Row label="Rows Validated" value={preview ? String(preview.total) : '-'} />
        <Row label="Recent Batches" value={String(batches.length)} />
      </dl>
      <div className="mt-3 flex flex-wrap gap-1">
        {selectedFields.map((field) => (
          <span
            key={field.fieldKey}
            className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary"
          >
            {field.label}
          </span>
        ))}
      </div>
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'ok' | 'bad' }) {
  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2',
        tone === 'ok' && 'border-emerald-500/30 bg-emerald-500/5',
        tone === 'bad' && 'border-destructive/30 bg-destructive/5',
      )}
    >
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
