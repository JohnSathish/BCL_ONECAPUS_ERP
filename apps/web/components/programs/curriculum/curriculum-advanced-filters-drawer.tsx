'use client';

import { erpSelectClass } from '@/components/erp/form-primitives';
import {
  FilterDrawerApplyFooter,
  FilterDrawerFieldGroup,
  FilterDrawerSelectField,
  FilterDrawerShell,
} from '@/components/erp/filter-drawer-shell';
import {
  CURRICULUM_CATEGORIES,
  CURRICULUM_CREDIT_FILTERS,
  CURRICULUM_ENROLLMENT_STATUSES,
  CURRICULUM_MAPPING_STATUSES,
  CURRICULUM_VERSION_STATUSES,
  type CurriculumFilters,
} from '@/types/curriculum-filters';
import { cn } from '@/utils/cn';
import { categoryColorToken } from './curriculum-category-tokens';
import {
  clearAdvancedCurriculumFilters,
  countAdvancedCurriculumFilters,
} from './curriculum-filter-utils';
import { CurriculumQuickToggleCards } from './curriculum-quick-toggle-cards';

type Option = { id: string; label: string };

const DELIVERY_TYPES = [
  'THEORY',
  'PRACTICAL',
  'THEORY_PRACTICAL',
  'PROJECT',
  'INTERNSHIP',
  'FIELD_WORK',
  'SKILL_LAB',
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: CurriculumFilters;
  onChange: (patch: Partial<CurriculumFilters>) => void;
  departmentOptions: Option[];
  streamOptions: Option[];
  shiftOptions: Option[];
  batchOptions: Option[];
  onToggleCategory: (category: string) => void;
};

export function CurriculumAdvancedFiltersDrawer({
  open,
  onOpenChange,
  filters,
  onChange,
  departmentOptions,
  streamOptions,
  shiftOptions,
  batchOptions,
  onToggleCategory,
}: Props) {
  const advancedCount = countAdvancedCurriculumFilters(filters);

  return (
    <FilterDrawerShell
      open={open}
      onOpenChange={onOpenChange}
      title="Advanced filters"
      description="Academic scope, curriculum rules, and delivery criteria"
      footer={
        <FilterDrawerApplyFooter
          advancedCount={advancedCount}
          onResetAdvanced={() => onChange(clearAdvancedCurriculumFilters(filters))}
          onApply={() => onOpenChange(false)}
        />
      }
    >
      <FilterDrawerFieldGroup title="Academic scope">
        <FilterDrawerSelectField
          label="Department"
          value={filters.departmentId}
          onChange={(v) => onChange({ departmentId: v })}
          options={departmentOptions}
          placeholder="All departments"
        />
        <FilterDrawerSelectField
          label="Stream"
          value={filters.streamId}
          onChange={(v) => onChange({ streamId: v })}
          options={streamOptions}
          placeholder="All streams"
        />
        <FilterDrawerSelectField
          label="Shift"
          value={filters.shiftId}
          onChange={(v) => onChange({ shiftId: v })}
          options={shiftOptions}
          placeholder="All shifts"
        />
        <FilterDrawerSelectField
          label="Batch"
          value={filters.batchId}
          onChange={(v) => onChange({ batchId: v })}
          options={batchOptions}
          placeholder="All batches"
          disabled
        />
        <p className="text-[10px] text-muted-foreground">Batch filter — coming soon</p>
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Version status</span>
          <select
            className={erpSelectClass}
            value={filters.versionStatus}
            onChange={(e) => onChange({ versionStatus: e.target.value })}
          >
            {CURRICULUM_VERSION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status === 'ALL'
                  ? 'All versions'
                  : status === 'ACTIVE'
                    ? 'Active only'
                    : status.charAt(0) + status.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </label>
      </FilterDrawerFieldGroup>

      <FilterDrawerFieldGroup title="Curriculum scope">
        <div className="space-y-2">
          <span className="text-sm font-medium">Categories</span>
          <div className="flex flex-wrap gap-1.5">
            {CURRICULUM_CATEGORIES.map((category) => {
              const active = filters.categories.includes(category);
              const token = categoryColorToken(category);
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => onToggleCategory(category)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-all',
                    active ? token.pill : 'border-border/50 bg-muted/20 text-muted-foreground',
                    active && 'shadow-sm',
                  )}
                >
                  {category}
                </button>
              );
            })}
          </div>
        </div>
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Credits</span>
          <select
            className={erpSelectClass}
            value={filters.credits}
            onChange={(e) => onChange({ credits: e.target.value })}
          >
            <option value="">All credits</option>
            {CURRICULUM_CREDIT_FILTERS.map((c) => (
              <option key={c} value={c}>
                {c === 'gt4' ? '>4 credits' : `${c} credits`}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Mapping status</span>
          <select
            className={erpSelectClass}
            value={filters.mappingStatus}
            onChange={(e) => onChange({ mappingStatus: e.target.value })}
          >
            <option value="">All mappings</option>
            {CURRICULUM_MAPPING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ')}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Shared pool</span>
          <select
            className={erpSelectClass}
            value={filters.sharedPool}
            onChange={(e) =>
              onChange({
                sharedPool: e.target.value as CurriculumFilters['sharedPool'],
              })
            }
          >
            <option value="">All mappings</option>
            <option value="pool">Shared pool only</option>
            <option value="programme">Programme-specific only</option>
          </select>
        </label>
        <div className="space-y-2">
          <span className="text-sm font-medium">Quick views</span>
          <CurriculumQuickToggleCards
            activeToggle={filters.quickToggle}
            onToggle={(quickToggle) => onChange({ quickToggle })}
          />
        </div>
      </FilterDrawerFieldGroup>

      <FilterDrawerFieldGroup title="Delivery scope">
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Delivery type</span>
          <select
            className={erpSelectClass}
            value={filters.deliveryType}
            onChange={(e) => onChange({ deliveryType: e.target.value })}
          >
            <option value="">All delivery types</option>
            {DELIVERY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Enrollment</span>
          <select
            className={erpSelectClass}
            value={filters.enrollmentStatus}
            onChange={(e) => onChange({ enrollmentStatus: e.target.value })}
          >
            <option value="">All enrollment</option>
            {CURRICULUM_ENROLLMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Faculty assigned</span>
          <select
            className={erpSelectClass}
            value={filters.facultyAssigned}
            onChange={(e) =>
              onChange({
                facultyAssigned: e.target.value as CurriculumFilters['facultyAssigned'],
              })
            }
          >
            <option value="">All</option>
            <option value="true">Assigned faculty</option>
            <option value="false">Unassigned faculty</option>
          </select>
        </label>
      </FilterDrawerFieldGroup>
    </FilterDrawerShell>
  );
}
