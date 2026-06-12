'use client';

import { Label } from '@/components/ui/label';
import { COURSE_DELIVERY_LABELS, COURSE_DELIVERY_TYPES } from '@/constants/course-delivery';
import type { CourseCatalogFilterState } from '@/hooks/use-course-catalog-filters';
import type { Department } from '@/types/organization';
import type { ProgramVersion } from '@/types/programs';
import { cn } from '@/utils/cn';
import { NEP_CURRICULUM_CATEGORIES } from '@/constants/nep-curriculum-categories';

const COURSE_TYPES = ['CORE', 'ELECTIVE', 'SKILL', 'OPEN', 'LAB', 'PRACTICAL'] as const;
const NEP_CATEGORIES = NEP_CURRICULUM_CATEGORIES;

const selectClass =
  'h-9 w-full min-w-0 rounded-lg border border-border/80 bg-background px-2 text-xs text-foreground';

type ProgramVersionOption = ProgramVersion & {
  program: { code: string; name: string };
};

type Props = {
  filters: CourseCatalogFilterState;
  onFilterChange: <K extends keyof CourseCatalogFilterState>(
    key: K,
    value: CourseCatalogFilterState[K],
  ) => void;
  departments: Department[];
  programVersions: ProgramVersionOption[];
  layout?: 'inline' | 'stacked';
  className?: string;
};

export function CourseCatalogFilterFields({
  filters,
  onFilterChange,
  departments,
  programVersions,
  layout = 'inline',
  className,
}: Props) {
  const gridClass =
    layout === 'inline' ? 'flex flex-wrap items-end gap-2' : 'grid gap-3 sm:grid-cols-2';

  return (
    <div className={cn(gridClass, className)}>
      <FilterSelect
        label="Department"
        layout={layout}
        value={filters.departmentId}
        onChange={(v) => onFilterChange('departmentId', v)}
      >
        <option value="">All departments</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.code ? `${d.code} — ${d.name}` : d.name}
          </option>
        ))}
      </FilterSelect>

      <FilterSelect
        label="CBCS type"
        layout={layout}
        value={filters.courseType}
        onChange={(v) => onFilterChange('courseType', v)}
      >
        <option value="">All CBCS types</option>
        {COURSE_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </FilterSelect>

      <FilterSelect
        label="Delivery"
        layout={layout}
        value={filters.deliveryType}
        onChange={(v) => onFilterChange('deliveryType', v)}
      >
        <option value="">All delivery types</option>
        {COURSE_DELIVERY_TYPES.map((t) => (
          <option key={t} value={t}>
            {t === 'THEORY_PRACTICAL' ? 'Hybrid' : COURSE_DELIVERY_LABELS[t]}
          </option>
        ))}
      </FilterSelect>

      <FilterSelect
        label="Programme"
        layout={layout}
        value={filters.programVersionId}
        onChange={(v) => onFilterChange('programVersionId', v)}
      >
        <option value="">All programmes</option>
        {programVersions.map((pv) => (
          <option key={pv.id} value={pv.id}>
            {pv.program.code} v{pv.version}
          </option>
        ))}
      </FilterSelect>

      <FilterSelect
        label="Semester"
        layout={layout}
        value={filters.semesterSequence}
        onChange={(v) => onFilterChange('semesterSequence', v)}
      >
        <option value="">All semesters</option>
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <option key={n} value={String(n)}>
            Semester {n}
          </option>
        ))}
      </FilterSelect>

      <FilterSelect
        label="NEP role"
        layout={layout}
        value={filters.category}
        onChange={(v) => onFilterChange('category', v)}
      >
        <option value="">All NEP roles</option>
        {NEP_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </FilterSelect>
    </div>
  );
}

function FilterSelect({
  label,
  layout,
  value,
  onChange,
  children,
}: {
  label: string;
  layout: 'inline' | 'stacked';
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  if (layout === 'inline') {
    return (
      <select
        className={cn(selectClass, 'min-w-[8.5rem] max-w-[11rem]')}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <select className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
    </div>
  );
}
