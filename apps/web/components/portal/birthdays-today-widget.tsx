'use client';

import Link from 'next/link';
import { Cake, PartyPopper } from 'lucide-react';

import { GlassCard } from '@/components/erp/glass-card';
import { cn } from '@/utils/cn';

export type BirthdayWidgetPerson = {
  id: string;
  fullName: string;
  photoUrl?: string | null;
  role: 'student' | 'staff';
};

export type BirthdaysWidgetData = {
  isMyBirthday: boolean;
  birthdays: BirthdayWidgetPerson[];
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function AvatarBubble({
  person,
  highlight,
}: {
  person: BirthdayWidgetPerson;
  highlight?: boolean;
}) {
  if (person.photoUrl) {
    return (
      <img
        src={person.photoUrl}
        alt=""
        className={cn(
          'h-9 w-9 rounded-full object-cover ring-2',
          highlight ? 'ring-amber-400' : 'ring-border/60',
        )}
      />
    );
  }

  return (
    <span
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold',
        highlight
          ? 'bg-amber-100 text-amber-800 ring-2 ring-amber-400'
          : 'bg-primary/10 text-primary ring-2 ring-border/60',
      )}
    >
      {initials(person.fullName)}
    </span>
  );
}

export function BirthdaysTodayWidget({
  data,
  loading,
  notificationsHref,
  id = 'birthdays',
}: {
  data?: BirthdaysWidgetData;
  loading?: boolean;
  notificationsHref: string;
  id?: string;
}) {
  if (loading) {
    return (
      <GlassCard className="animate-pulse p-5">
        <div className="h-5 w-40 rounded bg-muted" />
        <div className="mt-4 space-y-2">
          <div className="h-10 rounded-lg bg-muted" />
          <div className="h-10 rounded-lg bg-muted" />
        </div>
      </GlassCard>
    );
  }

  const birthdays = data?.birthdays ?? [];
  const isMyBirthday = data?.isMyBirthday ?? false;
  const hasContent = isMyBirthday || birthdays.length > 0;

  return (
    <GlassCard id={id} className="overflow-hidden p-0">
      {isMyBirthday ? (
        <div className="border-b border-amber-200/60 bg-gradient-to-r from-amber-50 via-orange-50 to-rose-50 px-5 py-4 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-rose-950/20">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
            <PartyPopper className="h-5 w-5" />
            <p className="text-sm font-semibold">Happy Birthday!</p>
          </div>
          <p className="mt-1 text-xs text-amber-900/80 dark:text-amber-100/80">
            Wishing you a wonderful day from your campus community.
          </p>
        </div>
      ) : null}

      <div className="p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <Cake className="h-4 w-4 text-rose-500" />
            Today&apos;s Birthdays
          </h3>
          <Link
            href={notificationsHref}
            className="text-xs font-medium text-primary hover:underline"
          >
            Notifications
          </Link>
        </div>

        {!hasContent ? (
          <p className="mt-4 rounded-xl border border-dashed border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">
            No birthdays in your circle today.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {birthdays.map((person) => (
              <li
                key={`${person.role}-${person.id}`}
                className="flex items-center gap-3 rounded-lg border border-border/40 px-3 py-2"
              >
                <AvatarBubble person={person} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{person.fullName}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {person.role === 'staff' ? 'Staff' : 'Classmate'}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </GlassCard>
  );
}
