import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  variant?: 'default' | 'gold' | 'outline' | 'ghost';
};

export function Button({ asChild, variant = 'default', className, ...props }: ButtonProps) {
  const Component = asChild ? Slot : 'button';
  const variants = {
    default: 'bg-[#0B2E59] !text-white hover:bg-[#061F3D]',
    gold: 'bg-[#F4B400] !text-[#061F3D] hover:bg-[#C79A2B]',
    outline: 'border border-current bg-transparent',
    ghost: 'bg-transparent text-[#0B2E59] hover:bg-slate-100',
  };
  return (
    <Component
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-sm px-5 text-xs font-extrabold uppercase tracking-wider transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#F4B400] disabled:cursor-not-allowed disabled:opacity-60',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
