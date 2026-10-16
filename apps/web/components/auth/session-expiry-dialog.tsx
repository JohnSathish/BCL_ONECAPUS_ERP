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
  message?: string;
};

export function SessionExpiryDialog({
  open,
  onContinue,
  onLogout,
  busy,
  message,
}: SessionExpiryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={() => undefined}>
      <DialogContent
        data-session-expiry="true"
        overlayClassName="z-[200]"
        className="z-[200] sm:max-w-md"
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Session Expiring Soon</DialogTitle>
          <DialogDescription>
            {message ??
              'Your session will expire soon because this page has been idle. Choose Continue to stay signed in. Unsaved timetable slots and marks stay on this page until you continue or log out.'}
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
