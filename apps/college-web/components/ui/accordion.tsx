'use client';

import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';

export const Accordion = AccordionPrimitive.Root;

export function AccordionItem({ children, value }: { children: React.ReactNode; value: string }) {
  return (
    <AccordionPrimitive.Item value={value} className="accordion-item">
      {children}
    </AccordionPrimitive.Item>
  );
}

export function AccordionTrigger({ children }: { children: React.ReactNode }) {
  return (
    <AccordionPrimitive.Header>
      <AccordionPrimitive.Trigger className="accordion-trigger">
        {children}
        <ChevronDown />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

export function AccordionContent({ children }: { children: React.ReactNode }) {
  return (
    <AccordionPrimitive.Content className="accordion-content">
      <div>{children}</div>
    </AccordionPrimitive.Content>
  );
}
