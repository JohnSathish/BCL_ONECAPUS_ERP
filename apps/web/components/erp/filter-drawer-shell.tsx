'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { erpSelectClass } from '@/components/erp/form-primitives';
import { cn } from '@/utils/cn';

export function FilterDrawerContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content asChild {...props}>
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className={cn(
            'glass-card fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border/80 shadow-2xl outline-none motion-reduce:transition-none',
            className,
          )}
        >
          {children}
        </motion.div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

type FilterDrawerShellProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export function FilterDrawerShell({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: FilterDrawerShellProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FilterDrawerContent aria-describedby={undefined}>
        <div className="flex items-start justify-between border-b border-border/60 px-5 py-4">
          <DialogHeader className="mb-0">
            <DialogTitle>{title}</DialogTitle>
            {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
          </DialogHeader>
          <DialogPrimitive.Close className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4">{children}</div>

        {footer ? (
          <div className="sticky bottom-0 flex flex-col gap-2 border-t border-border/60 bg-background/80 px-5 py-4 backdrop-blur">
            {footer}
          </div>
        ) : null}
      </FilterDrawerContent>
    </Dialog>
  );
}

export function FilterDrawerFieldGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

export function FilterDrawerSelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <label className="space-y-1.5 text-sm">
      <span className="font-medium">{label}</span>
      <select
        className={erpSelectClass}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FilterDrawerApplyFooter({
  advancedCount,
  onResetAdvanced,
  onApply,
}: {
  advancedCount: number;
  onResetAdvanced?: () => void;
  onApply: () => void;
}) {
  return (
    <>
      {advancedCount > 0 && onResetAdvanced ? (
        <Button type="button" size="sm" variant="ghost" onClick={onResetAdvanced}>
          Reset advanced ({advancedCount})
        </Button>
      ) : null}
      <Button type="button" size="sm" className="w-full" onClick={onApply}>
        Apply filters
      </Button>
    </>
  );
}
