'use client';

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
import { Input } from '@/components/ui/input';

type Props = {
  open: boolean;
  courseLabel?: string;
  reasons: string[];
  onConfirm: (reason: string) => void;
  onCancel: () => void;
};

export function EligibilityOverrideDialog({
  open,
  courseLabel,
  reasons,
  onConfirm,
  onCancel,
}: Props) {
  const [reason, setReason] = useState('');

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setReason('');
      onCancel();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Override course eligibility</DialogTitle>
          <DialogDescription>
            {courseLabel
              ? `${courseLabel} is not eligible for this student.`
              : 'This course is not eligible for this student.'}
            {reasons[0] ? ` ${reasons[0]}` : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="override-reason">
            Override reason (required)
          </label>
          <Input
            id="override-reason"
            value={reason}
            placeholder="e.g. Approved by HOD for special case"
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!reason.trim()}
            onClick={() => {
              onConfirm(reason.trim());
              setReason('');
            }}
          >
            Confirm override
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
