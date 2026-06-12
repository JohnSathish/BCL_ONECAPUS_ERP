'use client';

import Link from 'next/link';
import { CreditCard, IdCard } from 'lucide-react';

import { GlassCard } from '@/components/erp/glass-card';
import { Button } from '@/components/ui/button';
import type { LibraryQrPass } from '@/types/library';
import type { StudentDashboardView } from '@/types/student-portal';

export function DigitalIdWidget({
  profile,
  qrPass,
  loading,
}: {
  profile?: StudentDashboardView['profile'];
  qrPass?: LibraryQrPass | null;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <GlassCard className="animate-pulse p-5">
        <div className="h-5 w-28 rounded bg-muted" />
        <div className="mt-4 h-24 rounded-xl bg-muted" />
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-5">
      <div className="flex items-center gap-2">
        <CreditCard className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold tracking-tight">Digital ID Card</h3>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Preview your CR80 ID card and request printing from the office
      </p>
      {qrPass?.qrImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={qrPass.qrImageUrl}
          alt=""
          className="mx-auto mt-4 h-24 w-24 rounded-xl border border-border/60 bg-white p-1"
        />
      ) : null}
      <p className="mt-2 text-center font-mono text-xs text-muted-foreground">
        {profile?.enrollmentNumber ?? '—'}
      </p>
      <Button asChild variant="outline" className="mt-4 w-full rounded-xl" size="sm">
        <Link href="/student/id-card">
          <IdCard className="mr-2 h-4 w-4" />
          View &amp; Request ID Card
        </Link>
      </Button>
    </GlassCard>
  );
}
