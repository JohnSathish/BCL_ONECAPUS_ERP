'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { brandingInputClass } from './branding-section-card';

type Props = {
  id: string;
  label: string;
  value?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
};

export function BrandingColorField({ id, label, value = '#2563eb', disabled, onChange }: Props) {
  const safe = /^#[0-9A-Fa-f]{3,6}$/.test(value) ? value : '#2563eb';

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      <div className="flex items-center gap-3">
        <div
          className="h-11 w-11 shrink-0 rounded-lg border border-border shadow-inner"
          style={{ backgroundColor: safe }}
        />
        <Input
          id={id}
          type="color"
          value={safe}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-14 shrink-0 cursor-pointer p-1"
          aria-label={`${label} color picker`}
        />
        <Input
          type="text"
          value={safe}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={brandingInputClass}
          pattern="^#[0-9A-Fa-f]{3,6}$"
          placeholder="#2563eb"
        />
      </div>
    </div>
  );
}
