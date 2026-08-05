'use client';

import { CheckCircle2, ClipboardCopy, Eye, EyeOff, Mail, MessageSquare } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/utils/cn';

export type PasswordResetSuccessDialogProps = {
  open: boolean;
  password: string | null;
  userLabel?: string | null;
  email?: string | null;
  mobile?: string | null;
  onOpenChange: (open: boolean) => void;
};

export function PasswordResetSuccessDialog({
  open,
  password,
  userLabel,
  email,
  mobile,
  onOpenChange,
}: PasswordResetSuccessDialogProps) {
  const passwordInputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [revealed, setRevealed] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);
  const value = password?.trim() || '';

  useEffect(() => {
    if (!open) {
      setRevealed(false);
      setCopiedToast(false);
      return;
    }
    const t = window.setTimeout(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.select();
    }, 50);
    return () => window.clearTimeout(t);
  }, [open, value]);

  async function copyPassword() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const el = inputRef.current;
      if (el) {
        el.focus();
        el.select();
        document.execCommand('copy');
      }
    }
    setCopiedToast(true);
    window.setTimeout(() => setCopiedToast(false), 2500);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'max-w-md overflow-hidden rounded-2xl p-0 shadow-2xl',
          'duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
          'data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95',
        )}
      >
        <div className="relative border-b border-border bg-gradient-to-br from-emerald-500/15 via-card to-card px-6 pb-5 pt-7">
          <DialogHeader className="mb-0 space-y-2 pr-6 text-left">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 space-y-1">
                <DialogTitle className="text-lg font-semibold tracking-tight">
                  Password Reset Successfully
                </DialogTitle>
                <DialogDescription className="text-sm leading-relaxed">
                  A new temporary password has been generated
                  {userLabel ? (
                    <>
                      {' '}
                      for <span className="font-medium text-foreground">{userLabel}</span>
                    </>
                  ) : (
                    ' for this account'
                  )}
                  .
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="space-y-2">
            <label
              htmlFor={passwordInputId}
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Temporary Password
            </label>
            <div className="flex items-stretch gap-1 rounded-xl border border-border bg-muted/40 p-1.5 shadow-sm">
              <input
                ref={inputRef}
                id={passwordInputId}
                type={revealed ? 'text' : 'password'}
                readOnly
                value={value || '—'}
                className="min-w-0 flex-1 bg-transparent px-2.5 py-2 font-mono text-sm tracking-wide outline-none select-all"
                onFocus={(e) => e.currentTarget.select()}
                onClick={(e) => e.currentTarget.select()}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                aria-label={revealed ? 'Hide password' : 'Show password'}
                onClick={() => setRevealed((v) => !v)}
                disabled={!value}
              >
                {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                aria-label="Copy password"
                onClick={() => void copyPassword()}
                disabled={!value}
              >
                <ClipboardCopy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div
            role="note"
            className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-sm leading-relaxed text-amber-950 dark:text-amber-100"
          >
            <p className="font-medium">This is a temporary password.</p>
            <p className="mt-1 text-amber-900/90 dark:text-amber-100/90">
              Please share it securely with the user. They will be prompted to change the password
              after their first login.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled
              title="Coming soon — email delivery is not enabled yet"
              className="gap-1.5"
            >
              <Mail className="h-3.5 w-3.5" />
              Send by Email
              {email ? (
                <span className="ml-1 max-w-[9rem] truncate text-[10px] text-muted-foreground">
                  ({email})
                </span>
              ) : null}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled
              title="Coming soon — SMS delivery is not enabled yet"
              className="gap-1.5"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Send by SMS
              {mobile ? (
                <span className="ml-1 text-[10px] text-muted-foreground">({mobile})</span>
              ) : null}
            </Button>
          </div>
        </div>

        <DialogFooter className="m-0 border-t border-border bg-muted/20 px-6 py-4 sm:justify-between">
          <Button
            type="button"
            className="gap-2"
            onClick={() => void copyPassword()}
            disabled={!value}
          >
            <ClipboardCopy className="h-4 w-4" />
            Copy Password
          </Button>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>

        <div
          aria-live="polite"
          className={cn(
            'pointer-events-none absolute bottom-20 left-1/2 z-10 -translate-x-1/2 rounded-full bg-emerald-700 px-3.5 py-1.5 text-xs font-medium text-white shadow-lg transition-all duration-200',
            copiedToast ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
          )}
        >
          Password copied to clipboard.
        </div>
      </DialogContent>
    </Dialog>
  );
}
