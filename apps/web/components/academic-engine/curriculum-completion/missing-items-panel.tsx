'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { CellSelection, CompletionMissingItem } from '@/types/curriculum-completion';
import { quickActionHref, quickActionLabel } from '@/types/curriculum-completion';

type Props = {
  selection: CellSelection;
  issueTypeFilter?: string;
  items: CompletionMissingItem[];
  isLoading: boolean;
  onClear: () => void;
};

export function MissingItemsPanel({
  selection,
  issueTypeFilter,
  items,
  isLoading,
  onClear,
}: Props) {
  const title = selection
    ? `${selection.programCode} · Sem ${selection.semesterSequence} · ${selection.category}`
    : issueTypeFilter
      ? `Issues: ${issueTypeFilter.replace(/_/g, ' ').toLowerCase()}`
      : 'Missing setup items';

  return (
    <div className="space-y-3 rounded-md border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">
            Click a matrix cell or KPI card to drill down
          </p>
        </div>
        {(selection || issueTypeFilter) && (
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            Clear
          </Button>
        )}
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !items.length ? (
        <p className="text-sm text-muted-foreground">No missing items for this selection.</p>
      ) : (
        <ul className="max-h-80 space-y-2 overflow-y-auto">
          {items.map((item, idx) => (
            <li
              key={`${item.programVersionId}-${item.semesterSequence}-${item.category}-${idx}`}
              className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">
                  {item.programCode} · Sem {item.semesterSequence} · {item.category}
                </p>
                <p className="text-xs text-muted-foreground">{item.message}</p>
                {item.courseCode ? (
                  <p className="text-xs text-muted-foreground">
                    {item.courseCode}
                    {item.courseTitle ? ` — ${item.courseTitle}` : ''}
                  </p>
                ) : null}
              </div>
              <Link
                href={quickActionHref(item)}
                className="inline-flex h-8 items-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-muted"
              >
                {quickActionLabel(item.quickAction)}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
