'use client';

import Link from 'next/link';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  HelpCircle,
  Trash2,
  Users,
} from 'lucide-react';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { useRequireAuth } from '@/hooks/use-auth';
import { useStaffPermissions } from '@/hooks/use-staff-permissions';
import { fetchDepartments } from '@/services/organization';
import { fetchAllStaff, fetchDesignations } from '@/services/staff';
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
  type StaffBulkUpdatePreviewRow,
  uploadStaffBulkUpdatePreview,
} from '@/services/staff-bulk-update';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

type UpdateMode = 'spreadsheet' | 'same';
type Audience = 'all' | 'department' | 'designation' | 'individual';

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

function asCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function StaffBulkUpdatePage() {
  const session = useRequireAuth();
  const perms = useStaffPermissions();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<UpdateMode>('spreadsheet');
  const [fieldKeys, setFieldKeys] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState<StaffBulkUpdatePreviewResult | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'ok' | 'bad'>('bad');
  const [templateGenerating, setTemplateGenerating] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [audience, setAudience] = useState<Audience>('all');
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [sameValue, setSameValue] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [filters, setFilters] = useState({ departmentId: '', designationId: '' });

  const fields = useQuery({
    queryKey: ['staff-bulk-update', 'fields'],
    queryFn: fetchStaffBulkUpdateFields,
    enabled: Boolean(session) && perms.canBulkUpdate,
  });
  const audienceFilterReady =
    audience === 'all' ||
    audience === 'individual' ||
    (audience === 'department' && Boolean(filters.departmentId)) ||
    (audience === 'designation' && Boolean(filters.designationId));
  const staffRows = useQuery({
    queryKey: ['staff-bulk-update', 'audience', filters, audience],
    queryFn: () =>
      fetchAllStaff({
        departmentId: audience === 'department' ? filters.departmentId || undefined : undefined,
        designationId: audience === 'designation' ? filters.designationId || undefined : undefined,
        status: 'ACTIVE',
      }),
    enabled: Boolean(session) && perms.canBulkUpdate && audienceFilterReady,
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
  const selectedField =
    flatFields.find((field) => field.fieldKey === fieldKeys[0]) ??
    flatFields.find((field) => field.fieldKey === 'email' || /email/i.test(field.label)) ??
    flatFields[0];
  const activeFieldKey = selectedField?.fieldKey ?? '';
  const staffList = staffRows.data?.data ?? [];
  const audiencePeople =
    audience === 'individual' ? staffList.filter((row) => pickedIds.includes(row.id)) : staffList;
  const audienceCount =
    audience === 'individual' ? pickedIds.length : (staffRows.data?.meta.total ?? 0);
  const staffByCode = new Map(staffList.map((row) => [row.employeeCode, row]));
  const inAudience = (row: StaffBulkUpdatePreviewRow) => {
    if (audience === 'all') return true;
    if (audience === 'individual') return pickedIds.includes(row.staffId);
    return staffList.some((person) => person.id === row.staffId);
  };
  const scopeReady =
    audience === 'all' ||
    (audience === 'department' && Boolean(filters.departmentId)) ||
    (audience === 'designation' && Boolean(filters.designationId)) ||
    (audience === 'individual' && pickedIds.length > 0);

  const rememberPreview = (data: StaffBulkUpdatePreviewResult) => {
    setPreview(data);
    setChecked(
      data.rows
        .filter((row) => inAudience(row) && row.errors.length === 0 && row.changes.length > 0)
        .map((row) => row.staffId),
    );
    setMessage('');
  };

  const previewMut = useMutation({
    mutationFn: async (uploaded?: File) => {
      const fieldKey = activeFieldKey;
      if (!fieldKey) throw new Error('Choose the field you want to update.');
      const matchingKey = safeMatchingKey([fieldKey], 'employeeCode');
      if (mode === 'spreadsheet') {
        const source = uploaded ?? file;
        if (!source) throw new Error('Upload an Excel file before preview.');
        return uploadStaffBulkUpdatePreview(source, [fieldKey], matchingKey);
      }
      if (!sameValue.trim()) throw new Error('Enter the value to set for the selected staff.');
      if (!scopeReady || audiencePeople.length === 0) {
        throw new Error('Choose the staff members to update.');
      }
      return previewStaffBulkUpdate({
        scope: {},
        fieldKeys: [fieldKey],
        updateMode: 'CSV',
        matchingKey,
        csvRows: audiencePeople.map((row) => ({
          [matchingKey]: matchingValue(matchingKey, row),
          [fieldKey]: sameValue.trim(),
        })),
      });
    },
    onSuccess: rememberPreview,
    onError: (error) => {
      setMessageTone('bad');
      setMessage(apiErrorMessage(error, 'Validation failed'));
    },
  });

  const applyMut = useMutation({
    mutationFn: async () => {
      if (!preview?.batchId) throw new Error('Preview the changes before updating.');
      const fieldKey = activeFieldKey;
      const shownValid = preview.rows.filter(
        (row) => inAudience(row) && row.errors.length === 0 && row.changes.length > 0,
      );
      const chosen = shownValid.filter((row) => checked.includes(row.staffId));
      if (!chosen.length) throw new Error('Select at least one valid staff record.');
      const allShownChecked = chosen.length === shownValid.length;
      if (audience === 'all' && preview.invalid === 0 && allShownChecked) {
        return applyStaffBulkUpdate(preview.batchId, false);
      }
      if (preview.rowsTruncated) {
        throw new Error(
          'This file has more rows than the preview. Correct invalid rows and upload it again.',
        );
      }
      const matchingKey = safeMatchingKey([fieldKey], 'employeeCode');
      const next = await previewStaffBulkUpdate({
        scope: {},
        fieldKeys: [fieldKey],
        updateMode: 'CSV',
        matchingKey,
        csvRows: chosen.map((row) => ({
          [matchingKey]: matchingKey === 'staffId' ? row.staffId : row.employeeCode,
          [fieldKey]: asCell(row.changes.find((change) => change.fieldKey === fieldKey)?.after),
        })),
      });
      if (next.invalid > 0 || next.valid === 0) {
        throw new Error('The selected rows are not ready to update.');
      }
      return applyStaffBulkUpdate(next.batchId, false);
    },
    onSuccess: (result) => {
      setMessageTone('ok');
      setMessage(result.message ?? `Updated ${result.applied ?? 0} staff records.`);
      void qc.invalidateQueries({ queryKey: ['staff'] });
      void qc.invalidateQueries({ queryKey: ['staff-bulk-update'] });
    },
    onError: (error) => {
      setMessageTone('bad');
      setMessage(apiErrorMessage(error, 'Update failed'));
    },
  });

  const rollbackMut = useMutation({
    mutationFn: rollbackStaffBulkUpdate,
    onSuccess: (result) => {
      setMessageTone('ok');
      setMessage(`Rolled back ${result.rolledBackStaff} staff records.`);
      void qc.invalidateQueries({ queryKey: ['staff-bulk-update', 'batches'] });
      void qc.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: (error) => {
      setMessageTone('bad');
      setMessage(apiErrorMessage(error, 'Rollback failed'));
    },
  });

  if (!session) return null;

  if (!perms.canBulkUpdate) {
    return (
      <DashboardShell role="admin" title="Bulk Update Staff">
        <p className="text-sm text-muted-foreground">
          You do not have permission to bulk update staff.
        </p>
      </DashboardShell>
    );
  }

  const chooseField = (fieldKey: string) => {
    setFieldKeys([fieldKey]);
    setPreview(null);
    setSameValue('');
    setMessage('');
  };

  const chooseAudience = (next: Audience) => {
    setAudience(next);
    setPreview(null);
    setMessage('');
    if (next !== 'individual') setPickerOpen(false);
    if (next === 'all') setFilters({ departmentId: '', designationId: '' });
    if (next === 'department') setFilters((current) => ({ ...current, designationId: '' }));
    if (next === 'designation') setFilters((current) => ({ ...current, departmentId: '' }));
  };

  const acceptFile = (next?: File | null) => {
    if (!next) return;
    const name = next.name.toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      setMessageTone('bad');
      setMessage('Only .xlsx or .xls files are allowed.');
      return;
    }
    if (next.size > 5 * 1024 * 1024) {
      setMessageTone('bad');
      setMessage('Maximum file size is 5 MB.');
      return;
    }
    setFile(next);
    setPreview(null);
    setMessage('');
    if (activeFieldKey) previewMut.mutate(next);
  };

  const clearAll = () => {
    setFile(null);
    setPreview(null);
    setChecked([]);
    setSameValue('');
    setMessage('');
    setPickedIds([]);
    setPickerQuery('');
  };

  const downloadTemplate = async () => {
    if (!activeFieldKey) return;
    setTemplateGenerating(true);
    try {
      await downloadStaffBulkUpdateTemplate(
        [activeFieldKey],
        safeMatchingKey([activeFieldKey], 'employeeCode'),
        {
          departmentId: audience === 'department' ? filters.departmentId || undefined : undefined,
          designationId:
            audience === 'designation' ? filters.designationId || undefined : undefined,
          status: 'ACTIVE',
        },
      );
    } catch (error) {
      setMessageTone('bad');
      setMessage(apiErrorMessage(error, 'Could not download the template'));
    } finally {
      setTemplateGenerating(false);
    }
  };

  const visibleRows = (preview?.rows ?? []).filter(inAudience);
  const selectedCount = visibleRows.filter(
    (row) => checked.includes(row.staffId) && row.errors.length === 0 && row.changes.length > 0,
  ).length;
  const validIds = visibleRows
    .filter((row) => row.errors.length === 0 && row.changes.length > 0)
    .map((row) => row.staffId);
  const visibleInvalid = visibleRows.filter((row) => row.errors.length > 0).length;
  const allValidChecked = validIds.length > 0 && validIds.every((id) => checked.includes(id));

  return (
    <DashboardShell role="admin" pageHeader={false} title="Bulk Update Staff">
      <div className="space-y-4">
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-100 bg-white px-4 py-4 shadow-sm dark:border-sky-900/60 dark:bg-slate-950">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2563eb] text-white shadow-sm">
              <Users className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                Bulk Update Staff Information
              </h1>
              <p className="text-sm text-slate-500">
                Update email ID, mobile number or any selected field for multiple staff members at
                once.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={() => setHelpOpen((open) => !open)}
          >
            <HelpCircle className="mr-2 h-4 w-4 text-[#2563eb]" />
            View Instructions
          </Button>
        </section>

        {helpOpen ? (
          <section className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-slate-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-slate-200">
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                Choose one field. Email, mobile, department, and designation are updated one at a
                time.
              </li>
              <li>
                Upload a filled Excel template, or type one value to set for every selected staff
                member.
              </li>
              <li>Limit the list to a department, a designation, or the people you tick.</li>
              <li>Check the preview. Valid rows can be updated. Invalid rows stay unchanged.</li>
              <li>A previous update can be rolled back from Recent updates.</li>
            </ol>
          </section>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-3">
          <Panel
            step="1"
            tone="blue"
            title="Select Field to Update"
            subtitle="Choose which field you want to update."
          >
            <FieldSelect fields={flatFields} value={activeFieldKey} onChange={chooseField} icon />
            <p className="mt-3 text-xs leading-5 text-slate-500">
              You can update one field at a time.
              <br />
              Examples: Email ID, Mobile Number, Department, Designation, etc.
            </p>
          </Panel>

          <Panel
            step="2"
            tone="green"
            title="Choose Update Method"
            subtitle="Select how you want to update the data."
          >
            <MethodCard
              active={mode === 'spreadsheet'}
              title="Upload from Excel"
              body="Use different values for each staff member."
              onClick={() => {
                setMode('spreadsheet');
                setPreview(null);
              }}
            />
            <MethodCard
              active={mode === 'same'}
              title="Set Same Value for All"
              body="Use the same value for all selected staff."
              onClick={() => {
                setMode('same');
                setFile(null);
                setPreview(null);
              }}
            />
          </Panel>

          <Panel
            step="3"
            tone="violet"
            title="Select Staff Members"
            subtitle="Choose which staff members to update."
            extra={
              <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                Total Staff: {staffRows.isLoading ? '…' : audienceCount}
              </span>
            }
          >
            <AudienceOption
              checked={audience === 'all'}
              label="All Staff"
              onChange={() => chooseAudience('all')}
            />
            <AudienceOption
              checked={audience === 'department'}
              label="By Department"
              onChange={() => chooseAudience('department')}
            >
              <select
                className={selectClass}
                value={filters.departmentId}
                disabled={audience !== 'department'}
                onChange={(event) => {
                  setFilters((current) => ({ ...current, departmentId: event.target.value }));
                  setPreview(null);
                }}
              >
                <option value="">-- Select Department --</option>
                {(departments.data ?? []).map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </AudienceOption>
            <AudienceOption
              checked={audience === 'designation'}
              label="By Designation"
              onChange={() => chooseAudience('designation')}
            >
              <select
                className={selectClass}
                value={filters.designationId}
                disabled={audience !== 'designation'}
                onChange={(event) => {
                  setFilters((current) => ({ ...current, designationId: event.target.value }));
                  setPreview(null);
                }}
              >
                <option value="">-- Select Designation --</option>
                {(designations.data ?? []).map((designation) => (
                  <option key={designation.id} value={designation.id}>
                    {designation.label}
                  </option>
                ))}
              </select>
            </AudienceOption>
            <AudienceOption
              checked={audience === 'individual'}
              label="Select Individual Staff"
              onChange={() => chooseAudience('individual')}
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-lg"
                disabled={audience !== 'individual'}
                onClick={() => setPickerOpen((open) => !open)}
              >
                + Choose Staff{pickedIds.length ? ` (${pickedIds.length})` : ''}
              </Button>
            </AudienceOption>
          </Panel>
        </div>

        {pickerOpen && audience === 'individual' ? (
          <section className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm dark:border-violet-900/50 dark:bg-slate-950">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Choose staff</p>
              <input
                value={pickerQuery}
                onChange={(event) => setPickerQuery(event.target.value)}
                placeholder="Search name or staff ID"
                className="h-9 w-full max-w-xs rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
            <div className="max-h-64 space-y-1 overflow-auto">
              {staffList
                .filter((row) => {
                  const query = pickerQuery.trim().toLowerCase();
                  if (!query) return true;
                  return (
                    row.fullName.toLowerCase().includes(query) ||
                    row.employeeCode.toLowerCase().includes(query)
                  );
                })
                .map((row) => (
                  <label
                    key={row.id}
                    className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-900"
                  >
                    <input
                      type="checkbox"
                      checked={pickedIds.includes(row.id)}
                      onChange={() => {
                        setPickedIds((current) =>
                          current.includes(row.id)
                            ? current.filter((id) => id !== row.id)
                            : [...current, row.id],
                        );
                        setPreview(null);
                      }}
                    />
                    <span className="w-24 font-medium text-slate-700 dark:text-slate-200">
                      {row.employeeCode}
                    </span>
                    <span>{row.fullName}</span>
                    <span className="text-slate-400">{row.department ?? ''}</span>
                  </label>
                ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <StepBadge n="4" tone="green" />
              <div>
                <h2 className="font-semibold text-slate-900 dark:text-slate-50">
                  {mode === 'spreadsheet' ? 'Upload Excel File' : 'Enter the Same Value'}
                </h2>
                <p className="text-sm text-slate-500">
                  {mode === 'spreadsheet'
                    ? 'Upload an Excel file with Staff ID or Employee ID and the new values. Download the template to get the required format.'
                    : `This value is written to ${selectedField?.label ?? 'the selected field'} for every staff member in the selection.`}
                </p>
              </div>
            </div>
            {mode === 'spreadsheet' ? (
              <Button
                type="button"
                className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
                disabled={!activeFieldKey || templateGenerating}
                onClick={() => void downloadTemplate()}
              >
                <Download className="mr-2 h-4 w-4" />
                {templateGenerating ? 'Preparing…' : 'Download Excel Template'}
              </Button>
            ) : (
              <Button
                type="button"
                className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
                disabled={!scopeReady || !sameValue.trim() || previewMut.isPending}
                onClick={() => previewMut.mutate(undefined)}
              >
                {previewMut.isPending ? 'Checking…' : 'Preview Changes'}
              </Button>
            )}
          </div>

          {mode === 'spreadsheet' ? (
            <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') fileInputRef.current?.click();
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragActive(false);
                  acceptFile(event.dataTransfer.files?.[0]);
                }}
                className={cn(
                  'flex min-h-[148px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-sky-300 bg-white px-4 text-center dark:bg-slate-950',
                  dragActive && 'border-[#2563eb] bg-sky-50',
                )}
              >
                <span className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-lg font-bold text-white">
                  X
                </span>
                <p className="font-semibold text-slate-800 dark:text-slate-100">
                  Drag & drop your Excel file here
                </p>
                <p className="text-sm text-[#2563eb]">or click to browse</p>
                <p className="mt-1 text-xs text-slate-400">
                  Only .xlsx or .xls files are allowed. Maximum size: 5 MB.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  className="hidden"
                  onChange={(event) => {
                    acceptFile(event.target.files?.[0]);
                    event.target.value = '';
                  }}
                />
              </div>
              {file ? (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-8 w-8 text-emerald-600" />
                    <div>
                      <p className="text-sm font-semibold">{file.name}</p>
                      <p className="text-xs text-slate-500">
                        {Math.max(1, Math.round(file.size / 1024)).toLocaleString()} KB · Uploaded
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50"
                      onClick={() => {
                        setFile(null);
                        setPreview(null);
                      }}
                    >
                      <Trash2 className="mr-1 h-4 w-4" />
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-950">
                  {previewMut.isPending
                    ? 'Reading the workbook…'
                    : 'The uploaded file appears here.'}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-100 bg-white p-4 dark:border-emerald-900/40 dark:bg-slate-950">
              <label className="mb-1 block text-xs font-medium text-slate-500">
                New {selectedField?.label ?? 'value'}
              </label>
              <SameValueInput
                field={selectedField}
                value={sameValue}
                onChange={(value) => {
                  setSameValue(value);
                  setPreview(null);
                }}
                departments={(departments.data ?? []).map((department) => ({
                  id: department.id,
                  label: department.name,
                }))}
                designations={(designations.data ?? []).map((designation) => ({
                  id: designation.id,
                  label: designation.label,
                }))}
                shifts={(shifts.data ?? []).map((shift) => ({ id: shift.id, label: shift.name }))}
              />
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-sm dark:border-violet-900/40 dark:bg-slate-950">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-violet-50/80 px-4 py-3 dark:bg-violet-950/30">
            <div className="flex items-start gap-3">
              <StepBadge n="5" tone="violet" />
              <div>
                <h2 className="font-semibold">Preview and Confirm</h2>
                <p className="text-sm text-slate-500">
                  Verify the data before updating. Only valid records will be processed.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <CountPill label="Total Records" value={visibleRows.length} />
              <CountPill label="Valid Records" value={validIds.length} tone="ok" />
              <CountPill label="Invalid Records" value={visibleInvalid} tone="bad" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-900">
                <tr>
                  <th className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={allValidChecked}
                      onChange={() => setChecked(allValidChecked ? [] : validIds)}
                      aria-label="Select valid rows"
                    />
                  </th>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Staff ID</th>
                  <th className="px-3 py-2">Staff Name</th>
                  <th className="px-3 py-2">Department</th>
                  <th className="px-3 py-2">Designation</th>
                  <th className="px-3 py-2">Current {selectedField?.label ?? 'Value'}</th>
                  <th className="px-3 py-2">
                    New {selectedField?.label ?? 'Value'}{' '}
                    {mode === 'spreadsheet' ? '(From Excel)' : ''}
                  </th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.length ? (
                  visibleRows.map((row, index) => (
                    <PreviewTableRow
                      key={row.staffId}
                      index={index + 1}
                      row={row}
                      fieldKey={activeFieldKey}
                      department={staffByCode.get(row.employeeCode)?.department}
                      designation={staffByCode.get(row.employeeCode)?.designation}
                      checked={checked.includes(row.staffId)}
                      onToggle={() =>
                        setChecked((current) =>
                          current.includes(row.staffId)
                            ? current.filter((id) => id !== row.staffId)
                            : [...current, row.staffId],
                        )
                      }
                    />
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-sm text-slate-400">
                      {previewMut.isPending
                        ? 'Checking the records…'
                        : preview
                          ? 'None of the selected staff are in this preview.'
                          : 'Upload a file or preview a same-value update to see the staff list here.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {preview?.rowsTruncated ? (
            <p className="border-t px-4 py-2 text-xs text-amber-700">
              Showing the first 250 rows. Correct every invalid row in the file before updating a
              list this large.
            </p>
          ) : null}
          {preview?.batchId && visibleInvalid > 0 ? (
            <div className="border-t px-4 py-2 text-right">
              <button
                type="button"
                className="text-xs font-medium text-[#2563eb]"
                onClick={() => void downloadStaffBulkUpdateErrorReport(preview.batchId)}
              >
                Download error report
              </button>
            </div>
          ) : null}
        </section>

        {message ? (
          <p
            className={cn(
              'rounded-xl border px-3 py-2 text-sm',
              messageTone === 'ok'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-rose-200 bg-rose-50 text-rose-700',
            )}
          >
            {message}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/admin/staff">
            <Button type="button" variant="outline" className="rounded-xl">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Staff List
            </Button>
          </Link>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50"
              onClick={clearAll}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Clear All
            </Button>
            <Button
              type="button"
              className="rounded-xl bg-[#2563eb] px-5 text-white hover:bg-blue-700"
              disabled={!preview || selectedCount === 0 || applyMut.isPending}
              onClick={() => applyMut.mutate()}
            >
              {applyMut.isPending ? 'Updating…' : `Update ${selectedCount} Staff Records`}
            </Button>
          </div>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium"
            onClick={() => setHistoryOpen((open) => !open)}
          >
            Recent updates
            <span className="text-xs text-slate-400">{historyOpen ? 'Hide' : 'Show'}</span>
          </button>
          {historyOpen ? (
            <div className="space-y-2 border-t px-4 py-3">
              {(batches.data ?? []).length === 0 ? (
                <p className="text-sm text-slate-400">No bulk updates yet.</p>
              ) : (
                (batches.data ?? []).slice(0, 8).map((batch) => (
                  <div
                    key={batch.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <span>
                      {new Date(batch.createdAt).toLocaleString()} · {batch.status} ·{' '}
                      {batch.appliedCount} updated
                    </span>
                    {perms.canBulkUpdateRollback &&
                    batch.status === 'APPLIED' &&
                    !batch.rolledBackAt ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={rollbackMut.isPending}
                        onClick={() => rollbackMut.mutate(batch.id)}
                      >
                        Roll back
                      </Button>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          ) : null}
        </section>
      </div>
    </DashboardShell>
  );
}

function matchingValue(
  key: StaffBulkUpdateMatchingKey,
  row: { id: string; employeeCode: string; shortCode?: string | null; email: string | null },
) {
  if (key === 'staffId') return row.id;
  if (key === 'shortCode') return row.shortCode ?? '';
  if (key === 'portalEmail') return row.email ?? '';
  return row.employeeCode;
}

const selectClass =
  'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

function Panel({
  step,
  tone,
  title,
  subtitle,
  extra,
  children,
}: {
  step: string;
  tone: 'blue' | 'green' | 'violet';
  title: string;
  subtitle: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
  const wash = {
    blue: 'border-sky-100 bg-sky-50/40 dark:border-sky-900/50 dark:bg-slate-950',
    green: 'border-emerald-100 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-slate-950',
    violet: 'border-violet-100 bg-violet-50/40 dark:border-violet-900/40 dark:bg-slate-950',
  }[tone];
  return (
    <section className={cn('rounded-2xl border p-4 shadow-sm', wash)}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <StepBadge n={step} tone={tone} />
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-slate-50">{title}</h2>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>
        </div>
        {extra}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function StepBadge({ n, tone }: { n: string; tone: 'blue' | 'green' | 'violet' }) {
  const color = {
    blue: 'bg-[#2563eb]',
    green: 'bg-emerald-500',
    violet: 'bg-violet-500',
  }[tone];
  return (
    <span
      className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white',
        color,
      )}
    >
      {n}
    </span>
  );
}

function FieldSelect({
  fields,
  value,
  onChange,
}: {
  fields: StaffBulkUpdateFieldDef[];
  value: string;
  onChange: (fieldKey: string) => void;
  icon?: boolean;
}) {
  return (
    <div className="relative">
      <select
        className={cn(selectClass, 'pl-3')}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {fields.map((field) => (
          <option key={field.fieldKey} value={field.fieldKey}>
            {field.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function MethodCard({
  active,
  title,
  body,
  onClick,
}: {
  active: boolean;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-3 rounded-xl border bg-white px-3 py-3 text-left dark:bg-slate-950',
        active
          ? 'border-amber-300 bg-amber-50 shadow-sm dark:bg-amber-950/20'
          : 'border-slate-200 dark:border-slate-700',
      )}
    >
      <span
        className={cn(
          'mt-0.5 h-4 w-4 shrink-0 rounded-full border-2',
          active
            ? 'border-[#2563eb] bg-[#2563eb] shadow-[inset_0_0_0_3px_white]'
            : 'border-slate-300',
        )}
      />
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-slate-500">{body}</span>
      </span>
    </button>
  );
}

function AudienceOption({
  checked,
  label,
  onChange,
  children,
}: {
  checked: boolean;
  label: string;
  onChange: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label className="flex items-center gap-2 text-sm">
        <input type="radio" checked={checked} onChange={onChange} />
        {label}
      </label>
      {children}
    </div>
  );
}

function CountPill({ label, value, tone }: { label: string; value: number; tone?: 'ok' | 'bad' }) {
  return (
    <span
      className={cn(
        'rounded-lg bg-white px-2.5 py-1 text-slate-600 shadow-sm dark:bg-slate-900',
        tone === 'ok' && 'text-emerald-600',
        tone === 'bad' && 'text-rose-600',
      )}
    >
      {label}: {value}
    </span>
  );
}

function PreviewTableRow({
  index,
  row,
  fieldKey,
  department,
  designation,
  checked,
  onToggle,
}: {
  index: number;
  row: StaffBulkUpdatePreviewRow;
  fieldKey: string;
  department?: string | null;
  designation?: string | null;
  checked: boolean;
  onToggle: () => void;
}) {
  const change = row.changes.find((item) => item.fieldKey === fieldKey) ?? row.changes[0];
  const invalid = row.errors.length > 0;
  const unchanged = !invalid && row.changes.length === 0;
  return (
    <tr className="border-t border-slate-100 dark:border-slate-800">
      <td className="px-3 py-2">
        <input
          type="checkbox"
          checked={checked}
          disabled={invalid || unchanged}
          onChange={onToggle}
          aria-label={`Select ${row.fullName}`}
        />
      </td>
      <td className="px-3 py-2">{index}</td>
      <td className="px-3 py-2 font-medium">{row.employeeCode}</td>
      <td className="px-3 py-2">{row.fullName}</td>
      <td className="px-3 py-2">{department || '—'}</td>
      <td className="px-3 py-2">{designation || '—'}</td>
      <td className="px-3 py-2 text-slate-500">{formatStaffBulkValue(change?.before)}</td>
      <td className={cn('px-3 py-2', invalid && 'text-rose-600')}>
        {formatStaffBulkValue(change?.after)}
      </td>
      <td className="px-3 py-2">
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-semibold',
            invalid
              ? 'bg-rose-50 text-rose-600'
              : unchanged
                ? 'bg-slate-100 text-slate-500'
                : 'bg-emerald-50 text-emerald-600',
          )}
        >
          {invalid ? 'Invalid' : unchanged ? 'Unchanged' : 'Valid'}
        </span>
      </td>
      <td className={cn('px-3 py-2 text-xs', invalid ? 'text-rose-600' : 'text-slate-400')}>
        {invalid ? row.errors.join(', ') : row.warnings?.join(', ') || '—'}
      </td>
    </tr>
  );
}

function SameValueInput({
  field,
  value,
  onChange,
  departments,
  designations,
  shifts,
}: {
  field?: StaffBulkUpdateFieldDef;
  value: string;
  onChange: (value: string) => void;
  departments: { id: string; label: string }[];
  designations: { id: string; label: string }[];
  shifts: { id: string; label: string }[];
}) {
  if (
    field?.lookupType === 'department' ||
    field?.lookupType === 'designation' ||
    field?.lookupType === 'shift'
  ) {
    const options =
      field.lookupType === 'department'
        ? departments
        : field.lookupType === 'designation'
          ? designations
          : shifts;
    return (
      <select
        className={selectClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Select {field.label}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      className={selectClass}
      type={field?.inputType === 'date' ? 'date' : field?.fieldKey === 'email' ? 'email' : 'text'}
      value={value}
      placeholder={`Enter ${field?.label ?? 'value'}`}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
