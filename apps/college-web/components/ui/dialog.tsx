'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;

export function DialogContent({
  className,
  children,
  style,
  ...props
}: DialogPrimitive.DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className="dialog-overlay"
        style={{ pointerEvents: 'none', zIndex: 1000 }}
      />
      <DialogPrimitive.Content
        className={cn('dialog-content', className)}
        style={{ ...style, pointerEvents: 'auto', zIndex: 1001 }}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="dialog-close" aria-label="Close">
          <X />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
