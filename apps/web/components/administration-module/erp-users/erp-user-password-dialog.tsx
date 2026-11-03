'use client';

import { useEffect, useState } from 'react';
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
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

type Props = {
  open: boolean;
  userName: string | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (payload: {
    newPassword: string;
    confirmPassword: string;
    forcePasswordChange: boolean;
  }) => void;
};

export function ErpUserPasswordDialog({ open, userName, saving, error, onClose, onSubmit }: Props) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forcePasswordChange, setForcePasswordChange] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNewPassword('');
    setConfirmPassword('');
    setForcePasswordChange(true);
    setLocalError(null);
  }, [open]);

  const submit = () => {
    if (!newPassword) {
      setLocalError('Enter a new password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setLocalError('Password and Confirm Password do not match.');
      return;
    }
    setLocalError(null);
    onSubmit({ newPassword, confirmPassword, forcePasswordChange });
  };

  const shownError = localError ?? error;

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>
            Set a new password for {userName ?? 'this ERP user'}. The current password is never
            shown, and the new one is not emailed. Share it with the user in person. All of their
            current sessions are signed out.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="erp-new-password">New Password</Label>
            <Input
              id="erp-new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <p className="text-xs text-slate-500">
              At least 8 characters with upper and lower case, a number and a symbol.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="erp-confirm-new-password">Confirm Password</Label>
            <Input
              id="erp-confirm-new-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
            <span className="text-sm">Require a password change at next sign-in</span>
            <Switch checked={forcePasswordChange} onCheckedChange={setForcePasswordChange} />
          </label>
        </div>
        {shownError ? (
          <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{shownError}</p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : 'Reset Password'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
