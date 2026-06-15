'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Circle, ChevronRight, GraduationCap, Settings, Wallet } from 'lucide-react';
import { fetchFeeSettings, fetchMonthlyPlans } from '@/services/fee-cycle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/utils/cn';

type Step = {
  id: string;
  title: string;
  description: string;
  done: boolean;
  href: string;
  action: string;
  icon: typeof Settings;
};

export function MonthlyFeeSetupGuide({ compact = false }: { compact?: boolean }) {
  const settingsQ = useQuery({ queryKey: ['fee-settings'], queryFn: fetchFeeSettings });
  const plansQ = useQuery({ queryKey: ['monthly-plans'], queryFn: fetchMonthlyPlans });

  const settings = settingsQ.data;
  const plans = plansQ.data ?? [];
  const advanceEnabled = Boolean(settings?.studentPortal?.allowAdvanceMonthlyPayment);
  const hasPlans = plans.length > 0;

  const steps: Step[] = [
    {
      id: 'plans',
      title: 'Configure monthly fee plans',
      description:
        'Set tuition and college fee amounts per programme. VTC and science rules apply automatically when demands are generated.',
      done: hasPlans,
      href: '/admin/fees/monthly-plans',
      action: 'Open monthly plans',
      icon: GraduationCap,
    },
    {
      id: 'generate',
      title: 'Generate monthly demands',
      description:
        'Finance must create demands before any month appears on the student calendar. Use bulk generate for all students or per-student month picker at the desk.',
      done: false,
      href: '/admin/fees/collections',
      action: 'Go to collection desk',
      icon: Wallet,
    },
    {
      id: 'advance',
      title: 'Enable advance monthly payment (optional)',
      description:
        'Lets students select future months that already have generated demands. Without demands, months stay locked even when this is on.',
      done: advanceEnabled,
      href: '/admin/fees/settings',
      action: 'Fee settings',
      icon: Settings,
    },
    {
      id: 'pay',
      title: 'Students pay via portal or desk',
      description:
        'Pending months show as checkboxes on the student fee calendar. Paid months are marked green; ungenerated months remain gray/locked.',
      done: false,
      href: '/student/fees',
      action: 'Student portal preview',
      icon: CheckCircle2,
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const readyForStudents = hasPlans && advanceEnabled;

  return (
    <Card className={cn('border-primary/20', compact ? '' : 'glass-card border-0')}>
      <CardHeader className={compact ? 'pb-2' : undefined}>
        <CardTitle className="text-base">Monthly fee unlock — setup walkthrough</CardTitle>
        <CardDescription>
          Follow these steps to unlock the student fee calendar. Demands are the key — settings
          alone cannot unlock months.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
          <span className="font-semibold">
            {completedCount}/{steps.length}
          </span>
          <span className="text-muted-foreground">prerequisites complete</span>
          {readyForStudents ? (
            <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
              Portal ready
            </span>
          ) : (
            <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
              Action needed
            </span>
          )}
        </div>

        <ol className="space-y-2">
          {steps.map((step, index) => (
            <li
              key={step.id}
              className={cn(
                'flex gap-3 rounded-xl border p-3 transition-colors',
                step.done ? 'border-emerald-200 bg-emerald-50/50' : 'border-border bg-card',
              )}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                {step.done ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Step {index + 1}
                </p>
                <p className="font-semibold">{step.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{step.description}</p>
                <Button variant="link" className="mt-1 h-auto p-0 text-xs" asChild>
                  <Link href={step.href}>
                    {step.action}
                    <ChevronRight className="ml-0.5 h-3 w-3" />
                  </Link>
                </Button>
              </div>
              <step.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            </li>
          ))}
        </ol>

        {!compact ? (
          <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 px-4 py-3 text-sm">
            <p className="font-semibold">Quick commands</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
              <li>
                <strong>All students:</strong> Collection Desk → &quot;Generate monthly fees&quot;
              </li>
              <li>
                <strong>One student:</strong> Search student → gray months in calendar → Generate
                selected
              </li>
              <li>
                <strong>API:</strong>{' '}
                <code className="text-xs">POST /v1/fees/monthly-demands/generate</code>
              </li>
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
