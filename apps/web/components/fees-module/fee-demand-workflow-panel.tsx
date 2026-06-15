'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  CircleAlert,
  FileText,
  Layers,
  RefreshCw,
} from 'lucide-react';
import { fetchFeeCycles, fetchMonthlyPlans } from '@/services/fee-cycle';
import { fetchFeeStructures } from '@/services/fees';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';

type WorkflowCard = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  icon: typeof Layers;
  steps: string[];
  ready: boolean;
  readyLabel: string;
  actionLabel: string;
};

export function FeeDemandWorkflowPanel({ compact = false }: { compact?: boolean }) {
  const cyclesQ = useQuery({ queryKey: ['fee-cycles'], queryFn: () => fetchFeeCycles() });
  const plansQ = useQuery({ queryKey: ['monthly-plans'], queryFn: fetchMonthlyPlans });
  const structuresQ = useQuery({
    queryKey: ['fees', 'structures'],
    queryFn: () => fetchFeeStructures(),
  });

  const cycles = cyclesQ.data ?? [];
  const activeCycles = cycles.filter((c) => c.status === 'ACTIVE');
  const plans = plansQ.data ?? [];
  const structures = structuresQ.data ?? [];
  const publishedStructures = structures.filter(
    (s) => s.status === 'PUBLISHED' || s.status === 'LOCKED',
  );

  const cards: WorkflowCard[] = [
    {
      id: 'admission',
      title: 'Admission / Session Fee',
      subtitle: 'Biennial FYUP cycles (Sem I, III, V, VII)',
      href: '/admin/fees/cycles',
      icon: Layers,
      steps: [
        'Set fee heads & amounts in Admission Fee Structure',
        'Activate the cycle for the current semester group',
        'Bulk-generate demands for all eligible students',
      ],
      ready: activeCycles.length > 0,
      readyLabel:
        activeCycles.length > 0
          ? `${activeCycles.length} active cycle(s) ready`
          : 'Configure & activate a fee cycle first',
      actionLabel: 'Open Fee Cycles',
    },
    {
      id: 'monthly',
      title: 'Monthly Tuition Fee',
      subtitle: 'Programme / major-wise monthly billing',
      href: '/admin/fees/monthly-plans',
      icon: Calendar,
      steps: [
        'Create monthly fee plans (tuition, college, development)',
        'Match plans to student programme & major',
        'Generate this month’s demands for all students',
      ],
      ready: plans.length > 0,
      readyLabel:
        plans.length > 0
          ? `${plans.length} monthly plan(s) configured`
          : 'Create at least one monthly fee plan',
      actionLabel: 'Open Monthly Plans',
    },
    {
      id: 'advanced',
      title: 'Advanced / Subject Fees',
      subtitle: 'Structure studio + demand generator',
      href: '/admin/fees/demands',
      icon: FileText,
      steps: [
        'Publish fee structures in Structure Studio',
        'Preview charges per student (duplicates flagged)',
        'Generate & publish demands to student ledgers',
      ],
      ready: publishedStructures.length > 0,
      readyLabel:
        publishedStructures.length > 0
          ? `${publishedStructures.length} published structure(s)`
          : 'Publish fee structures before generating',
      actionLabel: 'Open Demand Generator',
    },
  ];

  return (
    <section className="rounded-3xl border border-border/70 bg-card/90 p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">How fee demands work</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Fee amounts are <strong>not</strong> automatically assigned to every student. You
            configure structures or plans first, then <em>generate demands</em> — that creates the
            charge on each student’s ledger. Admission and monthly fees use dedicated screens; the
            generator below is for advanced programme-wise structures.
          </p>
        </div>
        <Link href="/admin/fees/renewals">
          <Button variant="outline" size="sm" className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Renewal Center
          </Button>
        </Link>
      </div>

      <div className={cn('grid gap-3', compact ? 'md:grid-cols-1' : 'md:grid-cols-3')}>
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.id}
              className="flex flex-col rounded-2xl border border-border/70 bg-background/70 p-4"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold">{card.title}</p>
                  <p className="text-xs text-muted-foreground">{card.subtitle}</p>
                </div>
              </div>

              <ol className="mt-3 list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
                {card.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>

              <div
                className={cn(
                  'mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium',
                  card.ready
                    ? 'bg-emerald-500/10 text-emerald-700'
                    : 'bg-amber-500/10 text-amber-800',
                )}
              >
                {card.ready ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <CircleAlert className="h-3 w-3" />
                )}
                {card.readyLabel}
              </div>

              <Link href={card.href} className="mt-4">
                <Button variant="secondary" size="sm" className="w-full gap-1.5">
                  {card.actionLabel}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
