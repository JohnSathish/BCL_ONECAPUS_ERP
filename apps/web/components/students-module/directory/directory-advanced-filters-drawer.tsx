'use client';

import { erpSelectClass } from '@/components/erp/form-primitives';
import {
  FilterDrawerApplyFooter,
  FilterDrawerFieldGroup,
  FilterDrawerSelectField,
  FilterDrawerShell,
} from '@/components/erp/filter-drawer-shell';
import type { DirectoryFilters } from '@/components/students-module/directory/directory-filter-bar';
import { countActiveFilters } from '@/components/students-module/directory/directory-utils';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: DirectoryFilters;
  onChange: (patch: Partial<DirectoryFilters>) => void;
  onResetAdvanced?: () => void;
  streamOptions: { id: string; label: string }[];
  departmentOptions: { id: string; label: string }[];
  sessionOptions: { id: string; label: string }[];
  categoryOptions: { id: string; label: string }[];
  religionOptions: { id: string; label: string }[];
};

export function DirectoryAdvancedFiltersDrawer({
  open,
  onOpenChange,
  filters,
  onChange,
  onResetAdvanced,
  streamOptions,
  departmentOptions,
  sessionOptions,
  categoryOptions,
  religionOptions,
}: Props) {
  const advancedCount = countActiveFilters({
    ...filters,
    search: '',
    programVersionId: '',
    semester: '',
    batchId: '',
    shiftId: '',
    studentStatus: '',
  });

  return (
    <FilterDrawerShell
      open={open}
      onOpenChange={onOpenChange}
      title="Advanced filters"
      description="Demographics, admission, and academic criteria"
      footer={
        <FilterDrawerApplyFooter
          advancedCount={advancedCount}
          onResetAdvanced={onResetAdvanced}
          onApply={() => onOpenChange(false)}
        />
      }
    >
      <FilterDrawerFieldGroup title="Academic">
        <FilterDrawerSelectField
          label="Stream"
          value={filters.streamId}
          onChange={(v) => onChange({ streamId: v })}
          options={streamOptions}
          placeholder="All streams"
        />
        <FilterDrawerSelectField
          label="Department"
          value={filters.departmentId}
          onChange={(v) => onChange({ departmentId: v })}
          options={departmentOptions}
          placeholder="All departments"
        />
        <FilterDrawerSelectField
          label="Session"
          value={filters.sessionId}
          onChange={(v) => onChange({ sessionId: v })}
          options={sessionOptions}
          placeholder="All sessions"
        />
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Academic status</span>
          <select
            className={erpSelectClass}
            value={filters.academicStatus}
            onChange={(e) => onChange({ academicStatus: e.target.value })}
          >
            <option value="">All</option>
            {['Studying', 'Promoted', 'Detained', 'Alumni'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </FilterDrawerFieldGroup>

      <FilterDrawerFieldGroup title="Demographics">
        <FilterDrawerSelectField
          label="Category (reservation)"
          value={filters.categoryLookupId}
          onChange={(v) => onChange({ categoryLookupId: v })}
          options={categoryOptions}
          placeholder="All categories"
        />
        <FilterDrawerSelectField
          label="Religion"
          value={filters.religionLookupId}
          onChange={(v) => onChange({ religionLookupId: v })}
          options={religionOptions}
          placeholder="All religions"
        />
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Differently abled</span>
          <select
            className={erpSelectClass}
            value={filters.differentlyAbled}
            onChange={(e) => onChange({ differentlyAbled: e.target.value })}
          >
            <option value="">All</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </label>
      </FilterDrawerFieldGroup>

      <FilterDrawerFieldGroup title="Admission">
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Admission type</span>
          <select
            className={erpSelectClass}
            value={filters.admissionType}
            onChange={(e) => onChange({ admissionType: e.target.value })}
          >
            <option value="">All types</option>
            {['REGULAR', 'LATERAL', 'MIGRATION', 'RE_ADMISSION'].map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Admission status</span>
          <select
            className={erpSelectClass}
            value={filters.admissionStatus}
            onChange={(e) => onChange({ admissionStatus: e.target.value })}
          >
            <option value="">All</option>
            {['ADMITTED', 'PROVISIONAL', 'CANCELLED'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </FilterDrawerFieldGroup>

      <FilterDrawerFieldGroup title="Modules & services">
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Fee status</span>
          <select
            className={erpSelectClass}
            value={filters.uiFeeDue ?? ''}
            onChange={(e) => onChange({ uiFeeDue: e.target.value })}
          >
            <option value="">All</option>
            <option value="true">Fee due</option>
          </select>
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Hostel</span>
          <select
            className={erpSelectClass}
            value={filters.uiHostel ?? ''}
            onChange={(e) => onChange({ uiHostel: e.target.value })}
          >
            <option value="">All</option>
            <option value="true">Hostel students</option>
          </select>
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">RFID assigned</span>
          <select
            className={erpSelectClass}
            value={filters.uiRfidAssigned ?? ''}
            onChange={(e) => onChange({ uiRfidAssigned: e.target.value })}
          >
            <option value="">All</option>
            <option value="true">Assigned</option>
            <option value="false">Not assigned</option>
          </select>
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Subject registration</span>
          <select
            className={erpSelectClass}
            value={filters.uiSubjectPending ?? ''}
            onChange={(e) => onChange({ uiSubjectPending: e.target.value })}
          >
            <option value="">All</option>
            <option value="true">Pending / incomplete</option>
          </select>
        </label>
      </FilterDrawerFieldGroup>
    </FilterDrawerShell>
  );
}
