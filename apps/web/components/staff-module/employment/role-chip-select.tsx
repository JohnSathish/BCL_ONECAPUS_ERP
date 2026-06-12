'use client';

import { cn } from '@/utils/cn';
import { roleChipLabel } from '@/components/staff-module/employment/employment-utils';

type RoleOption = { code: string; label: string };

type Props = {
  options: RoleOption[];
  selectedCodes: string[];
  onChange: (codes: string[]) => void;
  disabled?: boolean;
};

export function RoleChipSelect({ options, selectedCodes, onChange, disabled }: Props) {
  const toggle = (code: string) => {
    if (disabled) return;
    if (selectedCodes.includes(code)) {
      onChange(selectedCodes.filter((c) => c !== code));
    } else {
      onChange([...selectedCodes, code]);
    }
  };

  const selected = options.filter((o) => selectedCodes.includes(o.code));
  const available = options.filter((o) => !selectedCodes.includes(o.code));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {selected.map((role) => (
          <button
            key={role.code}
            type="button"
            disabled={disabled}
            onClick={() => toggle(role.code)}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary',
              disabled && 'opacity-60',
            )}
          >
            {roleChipLabel(role.code, role.label)}
            <span aria-hidden className="text-primary/70">
              ×
            </span>
          </button>
        ))}
        {selected.length === 0 ? (
          <span className="text-xs text-muted-foreground">No additional roles</span>
        ) : null}
      </div>
      {available.length > 0 ? (
        <select
          className="h-8 w-full max-w-xs rounded-md border border-input bg-background px-2 text-xs"
          disabled={disabled}
          value=""
          onChange={(e) => {
            if (e.target.value) toggle(e.target.value);
            e.target.value = '';
          }}
        >
          <option value="">+ Add role</option>
          {available.map((role) => (
            <option key={role.code} value={role.code}>
              {role.label}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}
