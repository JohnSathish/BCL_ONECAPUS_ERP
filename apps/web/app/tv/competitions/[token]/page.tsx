'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { CompetitionLiveScoreboard } from '@/components/campus-competitions/competition-live-scoreboard';
import { fetchPublicLiveBoard } from '@/services/campus-competitions';

export default function CompetitionTvPage() {
  const params = useParams<{ token: string }>();
  const token = decodeURIComponent(params.token ?? '');

  const boardQ = useQuery({
    queryKey: ['campus-competitions', 'tv', token],
    queryFn: () => fetchPublicLiveBoard(token),
    enabled: Boolean(token),
    refetchInterval: 4_000,
  });

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#1e3a5f_0%,_#0b1220_55%,_#05080f_100%)] text-white">
      <div className="mx-auto max-w-5xl px-6 py-10 md:px-10 md:py-14">
        {boardQ.isError ? (
          <div className="rounded-2xl border border-rose-400/40 bg-rose-950/40 px-6 py-10 text-center">
            <p className="text-lg font-semibold">Display board unavailable</p>
            <p className="mt-2 text-sm text-rose-100/80">
              {boardQ.error instanceof Error ? boardQ.error.message : 'Invalid or expired token'}
            </p>
          </div>
        ) : (
          <>
            <CompetitionLiveScoreboard
              board={boardQ.data}
              loading={boardQ.isLoading}
              variant="tv"
            />
            <p className="mt-8 text-center text-xs uppercase tracking-[0.25em] text-slate-500">
              Campus Competitions · TV mode · auto-refresh
            </p>
          </>
        )}
      </div>
    </div>
  );
}
