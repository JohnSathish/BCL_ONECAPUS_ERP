'use client';

import { Download, Loader2, Upload } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { PRESET_LIST, resolvePresetId } from '@/lib/theme/default-themes';
import { exportThemeSettings, importThemeSettings } from '@/services/branding';
import { BrandingSectionCard } from './branding-section-card';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';

type Props = {
  activePreset?: string;
  disabled?: boolean;
  applying?: string | null;
  onApply: (presetId: string) => void;
  onImported?: () => void;
};

export function ThemePresetsSection({
  activePreset,
  disabled,
  applying,
  onApply,
  onImported,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [category, setCategory] = useState('All');
  const categories = useMemo(
    () => [
      'All',
      ...Array.from(new Set(PRESET_LIST.map((preset) => preset.category ?? 'Corporate'))),
    ],
    [],
  );
  const filteredPresets = useMemo(
    () =>
      category === 'All'
        ? PRESET_LIST
        : PRESET_LIST.filter((preset) => (preset.category ?? 'Corporate') === category),
    [category],
  );
  const resolvedActivePreset = activePreset ? resolvePresetId(activePreset) : undefined;

  const handleExport = async () => {
    setExporting(true);
    try {
      const payload = await exportThemeSettings();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'theme-export.json';
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const payload = JSON.parse(text) as Record<string, unknown>;
      await importThemeSettings(payload);
      onImported?.();
    } finally {
      setImporting(false);
    }
  };

  return (
    <BrandingSectionCard
      title="Premium flagship themes"
      description="Modern SaaS theme packs for ERP dashboards, tables, forms, analytics, dark mode, and long-hour staff usage."
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || exporting}
          onClick={() => void handleExport()}
        >
          {exporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Export theme
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || importing}
          onClick={() => fileRef.current?.click()}
        >
          {importing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          Import theme
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleImport(file);
            e.target.value = '';
          }}
        />
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {categories.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setCategory(item)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-medium transition',
              category === item
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border/60 bg-card text-muted-foreground hover:text-foreground',
            )}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filteredPresets.map((preset) => {
          const isActive = resolvedActivePreset === preset.themeName;
          const isApplying = applying === preset.themeName;
          return (
            <button
              key={preset.themeName}
              type="button"
              disabled={disabled || Boolean(applying)}
              onClick={() => onApply(preset.themeName)}
              className={cn(
                'group relative overflow-hidden rounded-2xl border-2 bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
                isActive
                  ? 'border-primary ring-2 ring-primary/20'
                  : 'border-border/60 hover:border-primary/40',
                disabled && 'cursor-not-allowed opacity-60',
              )}
            >
              <div
                className="mb-3 overflow-hidden rounded-xl border"
                style={{ borderColor: preset.borderColor, backgroundColor: preset.topbarBg }}
              >
                <div className="flex h-20">
                  <div className="w-1/4 p-2" style={{ backgroundColor: preset.sidebarBg }}>
                    <div
                      className="mb-2 h-2 rounded-full opacity-80"
                      style={{ backgroundColor: preset.sidebarText }}
                    />
                    <div
                      className="h-2 rounded-full"
                      style={{ backgroundColor: preset.sidebarActive }}
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-2">
                    <div className="flex gap-1">
                      <span
                        className="h-2 w-10 rounded-full"
                        style={{ backgroundColor: preset.primaryColor }}
                      />
                      <span
                        className="h-2 w-8 rounded-full"
                        style={{ backgroundColor: preset.accentColor }}
                      />
                    </div>
                    <div className="grid flex-1 grid-cols-2 gap-2">
                      <div
                        className="rounded-lg border"
                        style={{ backgroundColor: preset.cardBg, borderColor: preset.borderColor }}
                      />
                      <div
                        className="rounded-lg border"
                        style={{ backgroundColor: preset.cardBg, borderColor: preset.borderColor }}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-sm font-semibold">{preset.label}</span>
                  <p className="mt-1 text-xs text-muted-foreground">{preset.mood}</p>
                </div>
                <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                  {preset.category}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                {preset.purpose}
              </p>
              <div className="mt-3 flex gap-1.5">
                {[preset.primaryColor, preset.accentColor, preset.sidebarBg, preset.cardBg].map(
                  (color) => (
                    <span
                      key={color}
                      className="h-4 w-4 rounded-full border border-border/40"
                      style={{ backgroundColor: color }}
                    />
                  ),
                )}
              </div>
              {isApplying ? (
                <Loader2 className="absolute left-3 top-3 h-4 w-4 animate-spin text-primary" />
              ) : null}
              {isActive ? (
                <span className="absolute right-3 top-3 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  Active
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </BrandingSectionCard>
  );
}
