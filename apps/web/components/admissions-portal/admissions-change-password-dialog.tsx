'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { KeyRound } from 'lucide-react';
import { changeApplicantPassword } from '@/services/admissions-portal';
import { logout } from '@/services/auth';
import { broadcastSessionMessage } from '@/lib/auth/session-broadcast';
import { tokenRefreshManager } from '@/lib/auth/token-refresh-manager';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiErrorMessage } from '@/utils/api-error';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AdmissionsChangePasswordDialog({ open, onOpenChange }: Props) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => changeApplicantPassword({ currentPassword, newPassword, confirmPassword }),
    onSuccess: async () => {
      setMessage('Password updated. Signing you out…');
      broadcastSessionMessage({ type: 'LOGOUT' });
      tokenRefreshManager.clearSchedule();
      useAuthStore.getState().setSession(null);
      await logout().catch(() => undefined);
      onOpenChange(false);
      router.replace('/admissions-portal/login');
    },
    onError: (err) => {
      setMessage(apiErrorMessage(err, 'Could not update password. Check your current password.'));
    },
  });

  const reset = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setMessage(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-[#2563eb]" />
            Change password
          </DialogTitle>
          <DialogDescription>
            Use a strong password with at least 8 characters. You will be signed out after updating.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setMessage(null);
            mutation.mutate();
          }}
        >
          <div>
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <div>
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>

          {message ? (
            <p className={mutation.isSuccess ? 'text-sm text-emerald-600' : 'text-sm text-red-600'}>
              {message}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Updating…' : 'Update password'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
