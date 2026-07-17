'use client';

import type { CompetitionLiveBoard } from '@/services/campus-competitions';

type Props = {
  board: CompetitionLiveBoard | undefined;
  loading?: boolean;
  compact?: boolean;
  showChrome?: boolean;
  /** Large-display / TV styling */
  variant?: 'default' | 'tv';
};

export function CompetitionLiveScoreboard({
  board,
  loading,
  compact,
  showChrome = true,
  variant = 'default',
}: Props) {
  const tv = variant === 'tv';
  if (loading && !board) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-400">
        Loading live board…
      </div>
    );
  }
  if (!board) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-400">
        No live data yet.
      </div>
    );
  }

  const top = board.leaderboard.slice(0, compact ? 6 : 12);

  return (
    <div className={compact ? 'space-y-4' : 'space-y-6'}>
      {showChrome ? (
        <header className="space-y-1">
          <p
            className={`text-xs font-semibold uppercase tracking-[0.2em] ${
              tv ? 'text-amber-300/90' : 'text-amber-600/90'
            }`}
          >
            Live scoreboard
          </p>
          <h2
            className={`${compact ? 'text-2xl' : 'text-4xl'} font-semibold tracking-tight ${
              tv ? 'text-white' : ''
            }`}
          >
            {board.meet.name}
          </h2>
          <p className={`text-sm ${tv ? 'text-slate-300' : 'text-slate-500'}`}>
            {board.meet.venue || board.meet.theme || board.meet.meetType}
            {board.liveEvent ? ` · Now: ${board.liveEvent.name}` : ''}
            {board.nextEvent && !board.liveEvent ? ` · Next: ${board.nextEvent.name}` : ''}
          </p>
        </header>
      ) : null}

      {board.announcements[0] ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            board.announcements[0].severity === 'URGENT'
              ? tv
                ? 'border-rose-400/50 bg-rose-950/50 text-rose-100'
                : 'border-rose-300 bg-rose-50 text-rose-900'
              : board.announcements[0].severity === 'ALERT'
                ? tv
                  ? 'border-amber-400/50 bg-amber-950/40 text-amber-100'
                  : 'border-amber-300 bg-amber-50 text-amber-950'
                : tv
                  ? 'border-sky-400/40 bg-sky-950/40 text-sky-100'
                  : 'border-sky-200 bg-sky-50 text-sky-950'
          }`}
        >
          <span className="font-semibold">Announcement · </span>
          {board.announcements[0].message}
        </div>
      ) : null}

      <div className="space-y-2">
        {top.map((row) => (
          <div
            key={row.id}
            className={`flex items-center justify-between rounded-2xl border px-4 py-3 shadow-sm backdrop-blur ${
              tv
                ? 'border-white/10 bg-white/10'
                : 'border-slate-200 bg-white/80 dark:border-white/10 dark:bg-slate-900/70'
            }`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`${compact ? 'text-lg' : 'text-2xl'} w-10 font-semibold tabular-nums ${
                  tv ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                #{row.rank}
              </span>
              <span
                className="h-3.5 w-3.5 rounded-full ring-2 ring-white/60"
                style={{ backgroundColor: row.color }}
              />
              <div>
                <p
                  className={`${compact ? 'text-base' : 'text-xl'} font-semibold ${
                    tv ? 'text-white' : ''
                  }`}
                >
                  {row.name}
                </p>
                <p className={`text-xs ${tv ? 'text-slate-400' : 'text-slate-500'}`}>
                  G{row.medals.gold} · S{row.medals.silver} · B{row.medals.bronze}
                </p>
              </div>
            </div>
            <p
              className={`${compact ? 'text-2xl' : 'text-4xl'} font-semibold tabular-nums ${
                tv ? 'text-white' : ''
              }`}
            >
              {row.points}
            </p>
          </div>
        ))}
      </div>

      {!compact && board.recentResults.length > 0 ? (
        <div>
          <h3
            className={`mb-2 text-sm font-semibold uppercase tracking-wide ${
              tv ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            Recent results
          </h3>
          <div className="grid gap-2 md:grid-cols-2">
            {board.recentResults.map((r, idx) => (
              <div
                key={`${r.eventId}-${r.position}-${idx}`}
                className={`rounded-xl border px-3 py-2 text-sm ${
                  tv
                    ? 'border-white/10 bg-white/10 text-slate-200'
                    : 'border-slate-200/80 bg-white/70'
                }`}
              >
                <p className="font-medium">
                  {r.eventName} · #{r.position}
                </p>
                <p className={tv ? 'text-slate-400' : 'text-slate-500'}>
                  {r.houseName ?? '—'}
                  {r.metricValue ? ` · ${r.metricValue}` : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
