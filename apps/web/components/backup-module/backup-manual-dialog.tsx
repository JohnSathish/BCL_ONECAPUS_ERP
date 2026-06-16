'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { triggerBackupRun } from '@/services/backup';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cloudSync: Array<{ provider: string; enabled: boolean }>;
};

const CONTENT_OPTIONS = [
  { id: 'database', label: 'Database', default: true },
  { id: 'documents', label: 'Documents', default: true },
  { id: 'photos', label: 'Student Photos', default: true },
  { id: 'certificates', label: 'Certificates', default: true },
  { id: 'settings', label: 'Settings', default: true },
  { id: 'naac', label: 'NAAC Files', default: true },
] as const;

function resolveBackupType(selected: Set<string>): string {
  if (selected.size === 1 && selected.has('database')) return 'DATABASE_ONLY';
  if (selected.has('database') && selected.size >= 2) return 'DATABASE_DOCUMENTS';
  return 'FULL_SNAPSHOT';
}

export function BackupManualDialog({ open, onOpenChange, cloudSync }: Props) {
  const qc = useQueryClient();
  const [content, setContent] = useState<Set<string>>(
    () => new Set(CONTENT_OPTIONS.map((o) => o.id)),
  );
  const [destLocal, setDestLocal] = useState(true);
  const [destAws, setDestAws] = useState(
    cloudSync.some((c) => c.provider === 'AWS_S3' && c.enabled),
  );
  const [destB2, setDestB2] = useState(
    cloudSync.some((c) => c.provider === 'BACKBLAZE_B2' && c.enabled),
  );

  const runM = useMutation({
    mutationFn: () => triggerBackupRun({ type: resolveBackupType(content) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['backups'] });
      onOpenChange(false);
    },
  });

  const toggleContent = (id: string) => {
    setContent((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size === 1) return prev;
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Take Backup Now</DialogTitle>
          <DialogDescription>
            Choose backup contents and destinations. Cloud uploads run automatically when targets
            are configured.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Include
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {CONTENT_OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={content.has(opt.id)}
                    onChange={() => toggleContent(opt.id)}
                    className="h-4 w-4 rounded border-border"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Destination
            </Label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={destLocal}
                  onChange={(e) => setDestLocal(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                Local repository
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={destAws}
                  onChange={(e) => setDestAws(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                AWS S3
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={destB2}
                  onChange={(e) => setDestB2(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                Backblaze B2
              </label>
            </div>
            {!destLocal && !destAws && !destB2 ? (
              <p className="mt-2 text-xs text-amber-600">Select at least one destination.</p>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => runM.mutate()}
            disabled={runM.isPending || (!destLocal && !destAws && !destB2)}
          >
            {runM.isPending ? 'Starting…' : 'Start Backup'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
