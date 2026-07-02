'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, UserMinus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { unassignFacultyFromShift } from '@/services/faculty-shifts';

type Props = {
  shiftId: string;
  staffProfileId: string;
  fullName: string;
};

export function ShiftFacultyUnassignButton({ shiftId, staffProfileId, fullName }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const unassignMutation = useMutation({
    mutationFn: () => unassignFacultyFromShift(staffProfileId, shiftId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['faculty-shifts', shiftId] });
      await queryClient.invalidateQueries({ queryKey: ['faculty-shifts', 'candidates', shiftId] });
      setOpen(false);
    },
  });

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 text-destructive hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <UserMinus className="mr-1.5 h-3.5 w-3.5" />
        Remove
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove from shift</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remove <strong>{fullName}</strong> from this shift roster? Timetable and teaching
            allocation may still reference them until updated separately.
          </p>
          {unassignMutation.isError ? (
            <p className="text-xs text-destructive">Could not remove assignment. Try again.</p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={unassignMutation.isPending}
              onClick={() => unassignMutation.mutate()}
            >
              {unassignMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removing…
                </>
              ) : (
                'Remove'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
