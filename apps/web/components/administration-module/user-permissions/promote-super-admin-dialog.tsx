'use client';

import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SUPER_ADMIN_PROMOTE_MODULES } from '@/lib/permissions/user-permission-ui';

type Props = {
  open: boolean;
  userName: string;
  userEmail: string;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export function PromoteSuperAdminDialog({
  open,
  userName,
  userEmail,
  loading,
  onConfirm,
  onClose,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Grant full ERP access?
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="font-medium">{userName}</p>
            <p className="text-xs text-muted-foreground">{userEmail}</p>
          </div>

          <p className="text-muted-foreground">
            This assigns the <strong>Super Admin</strong> role with unrestricted access to:
          </p>

          <ul className="grid grid-cols-2 gap-2">
            {SUPER_ADMIN_PROMOTE_MODULES.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm">
                <span className="text-emerald-600">✓</span>
                {item}
              </li>
            ))}
          </ul>

          <p className="text-xs text-muted-foreground">
            Manual permission overrides are not required. This action is logged in the audit trail.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm} disabled={loading}>
            {loading ? 'Assigning…' : 'Confirm — Promote to Super Admin'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
