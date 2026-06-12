'use client';

import { cn } from '@/utils/cn';

type Props = {
  header: React.ReactNode;
  config: React.ReactNode;
  preview: React.ReactNode;
  audit: React.ReactNode;
  stickyBar?: React.ReactNode;
};

export function BrandingStudioLayout({ header, config, preview, audit, stickyBar }: Props) {
  return (
    <div className="relative mx-auto w-full max-w-7xl pb-24">
      <div className="mb-8">{header}</div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
        <div className="flex flex-col gap-6 lg:col-span-8 lg:gap-8">{config}</div>
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-24">{preview}</div>
        </div>
      </div>

      <div className="mt-8">{audit}</div>

      {stickyBar}
    </div>
  );
}

export function BrandingConfigGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-6', className)}>
      {children}
    </div>
  );
}
