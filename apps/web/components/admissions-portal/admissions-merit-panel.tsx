'use client';

import Link from 'next/link';
import { Award, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';

type Props = {
  meritRank?: number | null;
  meritRound?: number | null;
  meritScore?: number | string | null;
  applicationStatus?: string;
  waitingList?: boolean;
  compact?: boolean;
  className?: string;
};

export function AdmissionsMeritPanel({
  meritRank,
  meritRound,
  meritScore,
  applicationStatus,
  waitingList,
  compact,
  className,
}: Props) {
  const submitted = applicationStatus && applicationStatus !== 'draft';
  const hasRank = meritRank != null;

  if (!submitted && !hasRank) {
    return null;
  }

  if (hasRank) {
    return (
      <div
        className={cn(
          'rounded-xl border border-sky-200 bg-gradient-to-r from-sky-50 to-white p-5 shadow-sm',
          compact && 'p-4',
          className,
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 text-sky-700">
              <Award className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-sky-700">
                Published merit rank
              </p>
              <p className="text-3xl font-bold text-[#1a2b4b]">#{meritRank}</p>
              <p className="mt-1 text-sm text-slate-600">
                {meritRound ? `Merit list round ${meritRound}` : 'Merit list'}
                {meritScore != null ? ` · Score ${formatScore(meritScore)}` : ''}
                {waitingList ? ' · Waiting list' : ''}
              </p>
            </div>
          </div>
          {!compact ? (
            <Button variant="outline" asChild>
              <Link href="/admissions-portal/status">View timeline</Link>
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200 bg-white p-5 shadow-sm',
        compact && 'p-4',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <BarChart3 className="mt-0.5 h-5 w-5 text-slate-400" />
        <div>
          <p className="font-semibold text-[#1a2b4b]">Merit list pending</p>
          <p className="mt-1 text-sm text-slate-600">
            Your application has been submitted. Merit ranks will appear here once the college
            publishes the list.
            {meritScore != null ? ` Your provisional score is ${formatScore(meritScore)}.` : ''}
          </p>
        </div>
      </div>
    </div>
  );
}

function formatScore(value: number | string) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : String(value);
}
