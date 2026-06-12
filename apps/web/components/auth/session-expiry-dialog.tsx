'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type SessionExpiryDialogProps = {
  open: boolean;
  onContinue: () => void;
  onLogout: () => void;
  busy?: boolean;
};

export function SessionExpiryDialog({
  open,
  onContinue,
  onLogout,
  busy,
}: SessionExpiryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={() => undefined}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Session Expiring Soon</DialogTitle>
          <DialogDescription>
            Your session will expire in 2 minutes due to inactivity.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onLogout} disabled={busy}>
            Logout
          </Button>
          <Button type="button" onClick={onContinue} disabled={busy}>
            {busy ? 'Refreshing…' : 'Continue Session'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
