'use client';

import { Input } from '@/components/ui/input';

export type RegistrationScope = {
  search: string;
  batchId: string;
  programVersionId: string;
  shiftId: string;
  statusFilter: string;
};

type RegistrationScopeBarProps = {
  scope: RegistrationScope;
  onChange: (patch: Partial<RegistrationScope>) => void;
  batchOptions: { id: string; label: string }[];
  programOptions: { id: string; label: string }[];
  shiftOptions: { id: string; label: string }[];
};

export function RegistrationScopeBar({
  scope,
  onChange,
  batchOptions,
  programOptions,
  shiftOptions,
}: RegistrationScopeBarProps) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Input
        className="h-9 min-w-[180px] flex-1"
        placeholder="Search enrollment / name / email"
        value={scope.search}
        onChange={(e) => onChange({ search: e.target.value })}
      />
      <select
        className="h-9 rounded-md border border-border bg-card px-2 text-sm"
        value={scope.programVersionId}
        onChange={(e) => onChange({ programVersionId: e.target.value })}
      >
        <option value="">All programmes</option>
        {programOptions.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
      <select
        className="h-9 rounded-md border border-border bg-card px-2 text-sm"
        value={scope.batchId}
        onChange={(e) => onChange({ batchId: e.target.value })}
      >
        <option value="">All batches</option>
        {batchOptions.map((b) => (
          <option key={b.id} value={b.id}>
            {b.label}
          </option>
        ))}
      </select>
      <select
        className="h-9 rounded-md border border-border bg-card px-2 text-sm"
        value={scope.shiftId}
        onChange={(e) => onChange({ shiftId: e.target.value })}
      >
        <option value="">All shifts</option>
        {shiftOptions.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
      <select
        className="h-9 rounded-md border border-border bg-card px-2 text-sm"
        value={scope.statusFilter}
        onChange={(e) => onChange({ statusFilter: e.target.value })}
      >
        <option value="">All statuses</option>
        <option value="draft">Draft</option>
        <option value="pending_approval">Pending approval</option>
        <option value="completed">Completed</option>
      </select>
    </div>
  );
}
