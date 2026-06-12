'use client';

import type { LucideIcon } from 'lucide-react';

import { ErpFormSection } from '@/components/erp/erp-workspace-shell';

type Props = {
  icon: LucideIcon;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
};

/** Student admission section card — uses shared ERP form section styling. */
export function AdmissionFormSection({
  icon,
  title,
  description,
  children,
  className,
  collapsible,
  defaultOpen = true,
}: Props) {
  return (
    <ErpFormSection
      icon={icon}
      title={title}
      description={description}
      className={className}
      collapsible={collapsible}
      defaultOpen={defaultOpen}
    >
      {children}
    </ErpFormSection>
  );
}
