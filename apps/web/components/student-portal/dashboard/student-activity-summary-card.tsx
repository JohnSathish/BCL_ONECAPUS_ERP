'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Award, Medal, PartyPopper, Users } from 'lucide-react';
import { fetchMyEntries } from '@/services/campus-competitions';
import { fetchMyCertificateIssues } from '@/services/certificates';
import { fetchMyTranscript } from '@/services/department-activities';
import { useAuthQueryEnabled } from '@/hooks/use-auth';

type Stat = {
  label: string;
  value: number | string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
};

export function StudentActivitySummaryCard() {
  const enabled = useAuthQueryEnabled();

  const transcriptQ = useQuery({
    queryKey: ['student', 'dashboard', 'activity-transcript'],
    queryFn: () => fetchMyTranscript(),
    enabled,
    staleTime: 60_000,
    retry: 1,
  });
  const competitionsQ = useQuery({
    queryKey: ['student', 'dashboard', 'competitions-mine'],
    queryFn: fetchMyEntries,
    enabled,
    staleTime: 60_000,
    retry: 1,
  });
  const certificatesQ = useQuery({
    queryKey: ['student', 'dashboard', 'certificates-me'],
    queryFn: fetchMyCertificateIssues,
    enabled,
    staleTime: 60_000,
    retry: 1,
  });

  const loading = transcriptQ.isLoading || competitionsQ.isLoading || certificatesQ.isLoading;

  if (loading) {
    return (
      <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="h-5 w-36 rounded bg-muted" />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="h-16 rounded-xl bg-muted" />
          <div className="h-16 rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  const summary = transcriptQ.data?.summary;
  const eventsAttended = summary?.attended ?? summary?.total ?? 0;
  const certificates = certificatesQ.data?.length ?? summary?.withCertificates ?? 0;
  const competitions = competitionsQ.data?.length ?? 0;
  const clubs = summary?.awards ?? 0;

  const stats: Stat[] = [
    {
      label: 'Events attended',
      value: eventsAttended,
      href: '/student/department-activities',
      icon: PartyPopper,
      tone: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-200',
    },
    {
      label: 'Certificates',
      value: certificates,
      href: '/student/certificates',
      icon: Award,
      tone: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
    },
    {
      label: 'Competitions',
      value: competitions,
      href: '/student/campus-competitions',
      icon: Medal,
      tone: 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200',
    },
    {
      label: 'Awards / clubs',
      value: clubs,
      href: '/student/department-activities/transcript',
      icon: Users,
      tone: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
    },
  ];

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Activity Summary</h3>
        <Link
          href="/student/department-activities/transcript"
          className="text-xs font-medium text-[#1e4d8c] hover:underline dark:text-sky-300"
        >
          Transcript
        </Link>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.label}
              href={s.href}
              className={`rounded-xl px-3 py-2.5 transition hover:ring-1 hover:ring-[#1e4d8c]/25 ${s.tone}`}
            >
              <div className="flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5 opacity-80" />
                <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
                  {s.label}
                </span>
              </div>
              <p className="mt-1 text-xl font-bold tabular-nums">{s.value}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
