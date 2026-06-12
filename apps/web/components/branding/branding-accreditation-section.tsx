'use client';

import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import { useState } from 'react';
import type { UseFormSetValue } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ACCREDITATION_PRESETS } from '@/types/branding';
import { BrandingSectionCard, brandingInputClass } from './branding-section-card';
import type { BrandingFormValues } from './use-branding-studio-form';

type Props = {
  badges: string[];
  setValue: UseFormSetValue<BrandingFormValues>;
  disabled?: boolean;
};

export function BrandingAccreditationSection({ badges, setValue, disabled }: Props) {
  const [customInput, setCustomInput] = useState('');

  const addBadge = (label: string) => {
    const trimmed = label.trim();
    if (!trimmed || badges.includes(trimmed)) return;
    setValue('badges', [...badges, trimmed], { shouldDirty: true });
  };

  const removeBadge = (label: string) => {
    setValue(
      'badges',
      badges.filter((b) => b !== label),
      { shouldDirty: true },
    );
  };

  const moveBadge = (index: number, direction: -1 | 1) => {
    const next = [...badges];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    setValue('badges', next, { shouldDirty: true });
  };

  return (
    <BrandingSectionCard
      title="Accreditation & labels"
      description="Trust badges shown on login and portal surfaces. Reorder to control display priority."
    >
      <div className="space-y-5">
        {badges.length > 0 ? (
          <ul className="space-y-2" aria-label="Accreditation labels">
            {badges.map((badge, index) => (
              <li
                key={`${badge}-${index}`}
                className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{badge}</span>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={disabled || index === 0}
                    onClick={() => moveBadge(index, -1)}
                    aria-label={`Move ${badge} up`}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={disabled || index === badges.length - 1}
                    onClick={() => moveBadge(index, 1)}
                    aria-label={`Move ${badge} down`}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    disabled={disabled}
                    onClick={() => removeBadge(badge)}
                    aria-label={`Remove ${badge}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No accreditation labels yet.</p>
        )}

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Quick add
          </p>
          <div className="flex flex-wrap gap-2">
            {ACCREDITATION_PRESETS.map((preset) => (
              <Button
                key={preset}
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || badges.includes(preset)}
                onClick={() => addBadge(preset)}
              >
                <Plus className="mr-1 h-3 w-3" />
                {preset}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <Input
            className={brandingInputClass}
            placeholder="Custom label"
            value={customInput}
            disabled={disabled}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addBadge(customInput);
                setCustomInput('');
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={disabled || !customInput.trim()}
            onClick={() => {
              addBadge(customInput);
              setCustomInput('');
            }}
          >
            Add
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Icon and color per badge — coming in Phase 2.
        </p>
      </div>
    </BrandingSectionCard>
  );
}
