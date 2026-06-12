'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cloneProgramStructure } from '@/services/academic-engine';
import type { ProgramVersionOption } from './structure-types';

type CloneStructureDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetVersionId: string;
  versions: ProgramVersionOption[];
};

export function CloneStructureDialog({
  open,
  onOpenChange,
  targetVersionId,
  versions,
}: CloneStructureDialogProps) {
  const qc = useQueryClient();
  const [sourceVersionId, setSourceVersionId] = useState('');

  const cloneMut = useMutation({
    mutationFn: () => cloneProgramStructure(sourceVersionId, targetVersionId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['academic-engine', 'structure'] });
      onOpenChange(false);
      setSourceVersionId('');
    },
  });

  const sourceOptions = versions.filter((version) => version.id !== targetVersionId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Clone structure</DialogTitle>
          <DialogDescription>
            Copy semester structure rules from another programme version into the current version.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Source programme version
            </label>
            <select
              className="mt-1 h-9 w-full rounded-md border border-border bg-card px-2 text-sm"
              value={sourceVersionId}
              onChange={(e) => setSourceVersionId(e.target.value)}
            >
              <option value="">Select source…</option>
              {sourceOptions.map((version) => (
                <option key={version.id} value={version.id}>
                  {version.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!sourceVersionId || cloneMut.isPending}
              onClick={() => cloneMut.mutate()}
            >
              {cloneMut.isPending ? 'Cloning…' : 'Clone structure'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
