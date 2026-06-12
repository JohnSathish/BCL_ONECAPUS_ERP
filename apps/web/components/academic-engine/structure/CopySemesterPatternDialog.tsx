'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type CopySemesterPatternDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalSemesters: number;
  onCopy: (sourceSemester: number, targetSemesters: number[]) => void;
};

export function CopySemesterPatternDialog({
  open,
  onOpenChange,
  totalSemesters,
  onCopy,
}: CopySemesterPatternDialogProps) {
  const [sourceSemester, setSourceSemester] = useState(1);
  const [targets, setTargets] = useState<number[]>([]);

  useEffect(() => {
    if (!open) {
      setSourceSemester(1);
      setTargets([]);
    }
  }, [open]);

  const toggleTarget = (sem: number) => {
    setTargets((prev) =>
      prev.includes(sem) ? prev.filter((value) => value !== sem) : [...prev, sem],
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Copy semester pattern</DialogTitle>
          <DialogDescription>
            Copy category counts and continuity from one semester to others in the current draft.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Source semester</label>
            <select
              className="mt-1 h-9 w-full rounded-md border border-border bg-card px-2 text-sm"
              value={sourceSemester}
              onChange={(e) => setSourceSemester(Number(e.target.value))}
            >
              {Array.from({ length: totalSemesters }, (_, index) => index + 1).map((sem) => (
                <option key={sem} value={sem}>
                  Semester {sem}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Copy to semesters</p>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: totalSemesters }, (_, index) => index + 1)
                .filter((sem) => sem !== sourceSemester)
                .map((sem) => (
                  <label
                    key={sem}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-2 py-1 text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={targets.includes(sem)}
                      onChange={() => toggleTarget(sem)}
                    />
                    Sem {sem}
                  </label>
                ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!targets.length}
              onClick={() => {
                onCopy(sourceSemester, targets);
                onOpenChange(false);
              }}
            >
              Copy pattern
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
