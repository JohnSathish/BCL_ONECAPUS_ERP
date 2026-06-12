'use client';

import { cn } from '@/utils/cn';

type Props = {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  id?: string;
};

export function BrandingSectionCard({ title, description, children, className, id }: Props) {
  return (
    <section
      id={id}
      className={cn(
        'rounded-2xl border border-border/60 bg-card/80 shadow-sm backdrop-blur-sm',
        className,
      )}
    >
      <div className="border-b border-border/50 px-6 py-5 sm:px-8">
        <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="px-6 py-6 sm:px-8 sm:py-7">{children}</div>
    </section>
  );
}

export const brandingInputClass =
  'h-11 w-full rounded-lg border border-border bg-background px-3 text-sm';

export const brandingTextareaClass =
  'min-h-[100px] w-full resize-y rounded-lg border border-border bg-background px-3 py-2.5 text-sm';
