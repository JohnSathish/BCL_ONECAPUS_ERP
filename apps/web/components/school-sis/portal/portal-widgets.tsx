'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';
import { asList, asRecord, asText, initials, percentLabel } from './portal-utils';

export function PortalAvatar({
  src,
  name,
  size = 48,
}: {
  src?: string | null;
  name?: string | null;
  size?: number;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name || ''}
        className="rounded-2xl object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="inline-flex items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--school-erp-primary,#1a365d)_14%,white)] text-sm font-semibold text-[var(--school-erp-primary,#1a365d)]"
      style={{ width: size, height: size }}
    >
      {initials(name)}
    </span>
  );
}

export function DashboardCard({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('portal-card p-4 sm:p-5', className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[var(--heading,#0f172a)]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function QuickActionCard({
  href,
  icon: Icon,
  label,
  hint,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  hint?: string;
}) {
  return (
    <Link
      href={href}
      className="portal-card flex items-center gap-3 p-3 no-underline transition hover:-translate-y-0.5"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--school-erp-primary,#1a365d)_12%,white)] text-[var(--school-erp-primary,#1a365d)]">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[var(--heading,#0f172a)]">{label}</span>
        {hint ? (
          <span className="block text-xs text-[var(--muted-foreground,#64748b)]">{hint}</span>
        ) : null}
      </span>
    </Link>
  );
}

export function ProfileWidget({
  photoUrl,
  name,
  lines,
}: {
  photoUrl?: string | null;
  name: string;
  lines: string[];
}) {
  return (
    <section className="portal-card flex items-center gap-4 p-4 sm:p-5">
      <PortalAvatar src={photoUrl} name={name} size={64} />
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground,#64748b)]">
          Welcome
        </p>
        <h1 className="truncate text-xl font-semibold text-[var(--heading,#0f172a)]">{name}</h1>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--muted-foreground,#64748b)]">
          {lines.filter(Boolean).map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

export function AttendanceWidget({
  percent,
  present,
  absent,
  late,
  href,
}: {
  percent?: unknown;
  present?: unknown;
  absent?: unknown;
  late?: unknown;
  href?: string;
}) {
  const inner = (
    <>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground,#64748b)]">
        Attendance
      </p>
      <p className="mt-1 text-3xl font-semibold text-[var(--heading,#0f172a)]">
        {percentLabel(percent)}
      </p>
      <p className="mt-1 text-xs text-[var(--muted-foreground,#64748b)]">
        Present {asText(present, '0')} · Absent {asText(absent, '0')} · Late {asText(late, '0')}
      </p>
    </>
  );
  if (href) {
    return (
      <Link href={href} className="portal-card block p-4 no-underline sm:p-5">
        {inner}
      </Link>
    );
  }
  return <section className="portal-card p-4 sm:p-5">{inner}</section>;
}

export function TimetableWidget({
  slots,
  href,
  empty = 'No periods scheduled today.',
}: {
  slots: unknown;
  href?: string;
  empty?: string;
}) {
  const rows = asList(slots).slice(0, 6).map(asRecord);
  return (
    <DashboardCard
      title="Today’s timetable"
      action={
        href ? (
          <Link
            href={href}
            className="text-xs font-semibold text-[var(--school-erp-primary,#1a365d)]"
          >
            View all
          </Link>
        ) : null
      }
    >
      {rows.length ? (
        <ul className="space-y-2">
          {rows.map((row, i) => (
            <li
              key={asText(row.id, String(i))}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="min-w-0">
                <span className="block font-semibold text-[var(--heading,#0f172a)]">
                  {asText(row.subject ?? row.classLabel, 'Period')}
                </span>
                <span className="text-xs text-[var(--muted-foreground,#64748b)]">
                  {asText(row.classLabel ?? row.subject, '')}
                </span>
              </span>
              <span className="shrink-0 text-xs font-semibold text-[var(--muted-foreground,#64748b)]">
                {asText(row.start)}–{asText(row.end)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="portal-empty px-0 py-2">{empty}</p>
      )}
    </DashboardCard>
  );
}

export function AnnouncementWidget({
  items,
  href,
  title = 'Announcements',
}: {
  items: unknown;
  href?: string;
  title?: string;
}) {
  const rows = asList(items).slice(0, 5).map(asRecord);
  return (
    <DashboardCard
      title={title}
      action={
        href ? (
          <Link
            href={href}
            className="text-xs font-semibold text-[var(--school-erp-primary,#1a365d)]"
          >
            All
          </Link>
        ) : null
      }
    >
      {rows.length ? (
        <ul className="space-y-2">
          {rows.map((row, i) => (
            <li key={asText(row.id ?? row.slug, String(i))} className="text-sm">
              <p className="font-semibold text-[var(--heading,#0f172a)]">
                {asText(row.title ?? row.name, 'Notice')}
              </p>
              <p className="line-clamp-2 text-xs text-[var(--muted-foreground,#64748b)]">
                {asText(row.body ?? row.summary ?? row.excerpt, '')}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="portal-empty px-0 py-2">No notices yet.</p>
      )}
    </DashboardCard>
  );
}

export function EventWidget({ items, href }: { items: unknown; href?: string }) {
  return <AnnouncementWidget items={items} href={href} title="Upcoming events" />;
}

export function FeeWidget({
  pending,
  paid,
  href,
}: {
  pending?: unknown;
  paid?: unknown;
  href?: string;
}) {
  const inner = (
    <>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground,#64748b)]">
        Fees
      </p>
      <p className="mt-1 text-lg font-semibold text-[var(--heading,#0f172a)]">
        {asText(pending, 'No dues')}
      </p>
      {paid ? (
        <p className="mt-1 text-xs text-[var(--muted-foreground,#64748b)]">Paid {asText(paid)}</p>
      ) : null}
    </>
  );
  if (href) {
    return (
      <Link href={href} className="portal-card block p-4 no-underline sm:p-5">
        {inner}
      </Link>
    );
  }
  return <section className="portal-card p-4 sm:p-5">{inner}</section>;
}

export function ExamWidget({
  items,
  href,
  title = 'Examinations',
}: {
  items: unknown;
  href?: string;
  title?: string;
}) {
  return <AnnouncementWidget items={items} href={href} title={title} />;
}

export function NotificationPanel({
  items,
  empty = 'You are all caught up.',
}: {
  items: unknown;
  empty?: string;
}) {
  const rows = asList(items).slice(0, 12).map(asRecord);
  if (!rows.length) return <p className="portal-empty">{empty}</p>;
  return (
    <ul className="divide-y divide-[var(--border-subtle,#e8edf5)]">
      {rows.map((row, i) => (
        <li key={asText(row.id, String(i))} className="px-1 py-3">
          <p className="text-sm font-semibold text-[var(--heading,#0f172a)]">
            {asText(row.title ?? row.subject, 'Notification')}
          </p>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground,#64748b)]">
            {asText(row.body ?? row.message, '')}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function PortalKpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="portal-card p-4">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground,#64748b)]">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-[var(--heading,#0f172a)]">{value}</p>
      {hint ? <p className="mt-1 text-xs text-[var(--muted-foreground,#64748b)]">{hint}</p> : null}
    </div>
  );
}
