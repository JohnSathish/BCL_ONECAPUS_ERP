'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { CycleRolloverPreview } from '@/types/academic-lifecycle';

type Props = {
  preview: CycleRolloverPreview | undefined;
  loading?: boolean;
  applying?: boolean;
  rollingBack?: boolean;
  canManage: boolean;
  onApply: () => void;
  onRollback: () => void;
};

export function CycleRolloverWizard({
  preview,
  loading,
  applying,
  rollingBack,
  canManage,
  onApply,
  onRollback,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cycle rollover</CardTitle>
        <CardDescription>
          Promote all batches, freeze outgoing cycle, and activate the next ODD/EVEN semester set.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button type="button" variant="outline" onClick={() => setOpen((v) => !v)}>
          {open ? 'Hide preview' : 'Show rollover preview'}
        </Button>

        {open ? (
          loading ? (
            <p className="text-sm text-muted-foreground">Loading preview…</p>
          ) : preview ? (
            <div className="space-y-3 text-sm">
              <p>
                <span className="font-medium">{preview.outgoingCycle}</span> →{' '}
                <span className="font-medium">{preview.incomingCycle}</span>
              </p>
              <ul className="space-y-2 rounded-md border border-border p-3">
                {preview.batches.map((b) => (
                  <li key={b.batchId} className="flex flex-wrap justify-between gap-2">
                    <span>
                      {b.batchCode}: Sem {b.fromSequence} → Sem {b.toSequence}
                    </span>
                    <span className="text-muted-foreground">
                      {b.skipped
                        ? b.reason
                        : `${b.promoted} promote · ${b.detained} detained · ${b.completed} complete`}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-muted-foreground">
                Totals: {preview.totals.promoted} promoted · {preview.totals.detained} detained ·{' '}
                {preview.totals.completed} completing programme
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No preview data.</p>
          )
        ) : null}

        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={applying || !preview} onClick={onApply}>
              {applying ? 'Applying…' : 'Apply cycle rollover'}
            </Button>
            <Button type="button" variant="outline" disabled={rollingBack} onClick={onRollback}>
              {rollingBack ? 'Rolling back…' : 'Rollback last rollover'}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
