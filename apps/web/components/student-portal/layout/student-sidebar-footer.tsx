'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { fetchStudentDashboard, fetchStudentPortalMe } from '@/services/student-portal';
import { resolveUploadAssetUrl } from '@/lib/branding-asset';
import { cn } from '@/utils/cn';

function romanSemester(n: number) {
  const map = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
  return map[n] ?? String(n);
}

export function StudentSidebarFooter({ collapsed }: { collapsed: boolean }) {
  const meQ = useQuery({
    queryKey: ['student', 'portal', 'me', 'sidebar'],
    queryFn: fetchStudentPortalMe,
    staleTime: 120_000,
  });
  const dashQ = useQuery({
    queryKey: ['student-portal', 'dashboard'],
    queryFn: fetchStudentDashboard,
    staleTime: 120_000,
  });

  const me = meQ.data;
  const name = me?.displayFullName || me?.fullName || 'Student';
  const photo = me?.photoUrl ? resolveUploadAssetUrl(me.photoUrl) : null;
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');
  const programme =
    me?.programName || dashQ.data?.profile.programLabel || me?.department || 'Student';
  const sem = dashQ.data?.profile.semesterSequence;
  const shift =
    dashQ.data?.profile.shiftName?.trim() || dashQ.data?.profile.shiftCode?.trim() || null;
  const programmeLine =
    sem != null
      ? `${programme} · Semester ${romanSemester(sem)}${shift ? ` · ${shift}` : ''}`
      : shift
        ? `${programme} · ${shift}`
        : programme;

  if (collapsed) {
    return (
      <Link
        href="/student/my-profile"
        className="mx-auto flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-sky-600/30 ring-2 ring-emerald-400/60"
        title={name}
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-[10px] font-semibold text-sidebar-foreground">{initials}</span>
        )}
      </Link>
    );
  }

  return (
    <Link
      href="/student/my-profile"
      className={cn(
        'flex items-center gap-2.5 rounded-xl border border-sidebar-border/50 bg-sidebar-active/30 px-2.5 py-2',
        'transition hover:bg-sidebar-active/50',
      )}
    >
      <div className="relative shrink-0">
        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-sky-600/40 text-xs font-semibold text-white">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="h-full w-full object-cover" />
          ) : (
            initials || '?'
          )}
        </div>
        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-sidebar" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-sidebar-foreground">{name}</p>
        <p className="truncate text-[10px] text-sidebar-muted">{programmeLine}</p>
        <p className="text-[10px] font-medium text-emerald-400">Online</p>
      </div>
    </Link>
  );
}
