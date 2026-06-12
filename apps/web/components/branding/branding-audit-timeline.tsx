'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import type { BrandingAuditEntry, InstitutionBranding } from '@/types/branding';
import { formatShortDate } from '@/utils/format-date';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { BrandingSectionCard, brandingInputClass } from './branding-section-card';

const ACTION_LABELS: Record<string, string> = {
  'branding.updated': 'Branding settings updated',
  'branding.theme_updated': 'Theme tokens updated',
  'branding.theme_preset_applied': 'Theme preset applied',
  'branding.logo_uploaded': 'Logo uploaded',
  'branding.favicon_uploaded': 'Favicon uploaded',
};

type AuditMetadata = {
  before?: Partial<InstitutionBranding> & Record<string, unknown>;
  after?: Partial<InstitutionBranding> & Record<string, unknown>;
  diff?: Record<string, { before: unknown; after: unknown }>;
  presetId?: string;
  previousUrl?: string;
  newUrl?: string;
  mimeType?: string;
  size?: number;
};

function formatAction(action: string): string {
  return ACTION_LABELS[action] ?? action.replace('branding.', '').replace(/_/g, ' ');
}

function diffLines(metadata: unknown): string[] {
  const meta = metadata as AuditMetadata;
  const lines: string[] = [];

  if (meta.diff && typeof meta.diff === 'object') {
    for (const [key, change] of Object.entries(meta.diff)) {
      lines.push(`${key}: ${JSON.stringify(change.before)} → ${JSON.stringify(change.after)}`);
    }
  }

  if (meta.presetId) {
    lines.push(`Preset applied: ${meta.presetId}`);
  }

  if (meta.before && meta.after) {
    const fields: (keyof InstitutionBranding)[] = [
      'displayName',
      'shortName',
      'portalSubtitle',
      'primaryColor',
      'accentColor',
      'sidebarColor',
      'loginBackgroundStyle',
    ];
    for (const field of fields) {
      const b = meta.before[field];
      const a = meta.after[field];
      if (b !== a && (b !== undefined || a !== undefined)) {
        lines.push(`${String(field)}: "${String(b ?? '—')}" → "${String(a ?? '—')}"`);
      }
    }
    const bBadges = meta.before.badges?.length ?? 0;
    const aBadges = meta.after.badges?.length ?? 0;
    if (bBadges !== aBadges) {
      lines.push(`Accreditation labels: ${bBadges} → ${aBadges}`);
    }
    if (meta.before.brandingEnabled !== meta.after.brandingEnabled) {
      lines.push(
        `Branding enabled: ${String(meta.before.brandingEnabled)} → ${String(meta.after.brandingEnabled)}`,
      );
    }
  }

  if (meta.newUrl) {
    lines.push(`New asset URL: ${meta.newUrl}`);
  }
  if (meta.mimeType) {
    lines.push(`File: ${meta.mimeType}${meta.size ? ` (${Math.round(meta.size / 1024)} KB)` : ''}`);
  }

  return lines;
}

function ColorSwatch({ color }: { color?: string }) {
  if (!color || !/^#[0-9A-Fa-f]{3,6}$/.test(color)) return null;
  return (
    <span
      className="inline-block h-4 w-4 rounded border border-border align-middle"
      style={{ backgroundColor: color }}
      title={color}
    />
  );
}

type Props = {
  entries: BrandingAuditEntry[];
};

export function BrandingAuditTimeline({ entries }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.action.toLowerCase().includes(q) ||
        (e.user?.email ?? '').toLowerCase().includes(q) ||
        diffLines(e.metadata).some((l) => l.toLowerCase().includes(q)),
    );
  }, [entries, search]);

  return (
    <BrandingSectionCard
      title="Audit history"
      description="Recent branding changes with before/after details."
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className={`${brandingInputClass} pl-9`}
            placeholder="Search by action, user, or field…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search audit history"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0"
        >
          {expanded ? (
            <>
              <ChevronUp className="mr-1 h-4 w-4" />
              Collapse
            </>
          ) : (
            <>
              <ChevronDown className="mr-1 h-4 w-4" />
              Expand
            </>
          )}
        </Button>
      </div>

      {expanded ? (
        filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matching audit entries.</p>
        ) : (
          <ol className="relative space-y-0 border-l border-border/60 pl-6">
            {filtered.map((entry) => {
              const meta = entry.metadata as AuditMetadata;
              const changes = diffLines(entry.metadata);
              return (
                <li key={entry.id} className="relative pb-8 last:pb-0">
                  <span
                    className="absolute -left-[25px] top-1.5 h-3 w-3 rounded-full border-2 border-background bg-primary"
                    aria-hidden
                  />
                  <div className="rounded-xl border border-border/50 bg-muted/15 px-4 py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold">{formatAction(entry.action)}</p>
                      <time className="text-xs text-muted-foreground">
                        {formatShortDate(entry.createdAt)}
                      </time>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {entry.user?.email ?? 'System'}
                    </p>
                    {changes.length > 0 ? (
                      <ul className="mt-3 space-y-1.5 text-xs text-foreground/90">
                        {changes.map((line) => (
                          <li key={line} className="flex flex-wrap items-center gap-1.5">
                            {line.includes('primaryColor') || line.includes('accentColor') ? (
                              <>
                                <ColorSwatch
                                  color={line.match(/"#[0-9A-Fa-f]{3,6}"/g)?.[0]?.replace(/"/g, '')}
                                />
                                {line}
                              </>
                            ) : (
                              line
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {meta.after?.primaryColor || meta.after?.accentColor ? (
                      <div className="mt-2 flex gap-2">
                        {meta.after.primaryColor ? (
                          <ColorSwatch color={meta.after.primaryColor} />
                        ) : null}
                        {meta.after.accentColor ? (
                          <ColorSwatch color={meta.after.accentColor} />
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        )
      ) : (
        <p className="text-sm text-muted-foreground">
          {entries.length} audit {entries.length === 1 ? 'entry' : 'entries'} hidden.
        </p>
      )}
    </BrandingSectionCard>
  );
}
