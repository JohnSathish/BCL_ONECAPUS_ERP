'use client';

import type React from 'react';
import Link from 'next/link';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/utils/cn';

export function TimetableSectionPage({
  title,
  eyebrow,
  description,
  actions,
  children,
}: {
  title: string;
  eyebrow: string;
  description: string;
  actions?: { label: string; href: string; variant?: 'default' | 'outline' }[];
  children?: React.ReactNode;
}) {
  return (
    <DashboardShell role="admin" title={title}>
      <div className="space-y-5">
        <section className="rounded-3xl border border-border/60 bg-gradient-to-br from-primary/15 via-card to-card p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">
            {eyebrow}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
          {actions?.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {actions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className={cn(
                    'inline-flex h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors',
                    action.variant === 'outline'
                      ? 'border border-border bg-card hover:bg-muted'
                      : 'bg-primary text-primary-foreground hover:opacity-90',
                  )}
                >
                  {action.label}
                </Link>
              ))}
            </div>
          ) : null}
        </section>
        {children ?? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workspace Ready</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              This page is connected to the new consolidated FYUGP timetable workflow.
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardShell>
  );
}
