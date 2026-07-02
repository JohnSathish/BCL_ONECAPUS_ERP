'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ShiftTransferPreview } from '@/services/roll-number';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: ShiftTransferPreview | null;
  pending?: boolean;
  bulkCount?: number;
  onConfirm: () => void;
};

export function ShiftTransferConfirmDialog({
  open,
  onOpenChange,
  preview,
  pending = false,
  bulkCount = 1,
  onConfirm,
}: Props) {
  const isBulk = bulkCount > 1;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm shift transfer</DialogTitle>
        </DialogHeader>
        {preview && !isBulk ? (
          <div className="space-y-3 text-sm">
            <dl className="grid gap-2 rounded-md border border-border/70 bg-muted/20 p-3">
              <div className="grid grid-cols-2 gap-1">
                <dt className="text-muted-foreground">Current shift</dt>
                <dd className="font-medium">{preview.currentShift.name}</dd>
                <dt className="text-muted-foreground">New shift</dt>
                <dd className="font-medium">{preview.targetShift.name}</dd>
                <dt className="text-muted-foreground">Current roll no.</dt>
                <dd className="font-mono">{preview.currentRollNumber ?? '—'}</dd>
                <dt className="text-muted-foreground">New roll no.</dt>
                <dd className="font-mono font-semibold text-primary">
                  {preview.previewRollNumber}
                </dd>
              </div>
            </dl>
            <p className="text-xs text-amber-700 dark:text-amber-300">
              This action will permanently assign a new roll number. The previous roll number will
              be preserved in the audit history.
            </p>
          </div>
        ) : isBulk ? (
          <p className="text-sm text-muted-foreground">
            Transfer <strong>{bulkCount}</strong> students to the selected shift. Each student will
            receive the next available roll number in the destination shift sequence.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Loading preview…</p>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" disabled={pending || (!preview && !isBulk)} onClick={onConfirm}>
            {pending ? 'Transferring…' : 'Confirm transfer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
