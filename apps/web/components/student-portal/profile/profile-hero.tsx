'use client';

import Link from 'next/link';
import { CheckCircle2, Settings } from 'lucide-react';

import { GlassCard } from '@/components/erp/glass-card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { StudentName } from '@/components/students/student-name';
import { resolveUploadAssetUrl } from '@/lib/branding-asset';
import type { StudentPortalProfile360 } from '@/types/student-portal-profile';
import { profileDefaults } from './profile-utils';

export function ProfileHero({ profile }: { profile: StudentPortalProfile360 }) {
  const { completion } = profileDefaults(profile);
  const photoSrc = profile.personal.photoUrl
    ? resolveUploadAssetUrl(profile.personal.photoUrl)
    : null;

  const semesterLine = [
    profile.academic.semester != null ? `Semester ${profile.academic.semester}` : null,
    profile.academic.shift,
  ]
    .filter(Boolean)
    .join(' • ');

  return (
    <GlassCard className="overflow-hidden bg-gradient-to-br from-primary/8 via-card/90 to-accent/5 p-5 sm:p-6">
      <div className="flex flex-col items-center text-center md:items-start md:text-left">
        <div className="flex w-full flex-col items-center gap-4 md:flex-row md:items-start">
          {photoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoSrc}
              alt=""
              className="h-24 w-24 rounded-2xl border-2 border-border/60 object-cover shadow-md"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-2xl border-2 border-primary/20 bg-primary/10 text-2xl font-bold text-primary">
              {profile.personal.enrollmentNumber.slice(-2)}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold uppercase tracking-wide sm:text-2xl">
              <StudentName
                name={profile.personal.fullName}
                displayFullName={profile.personal.displayFullName}
              />
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {profile.academic.programme ?? 'Programme'}
            </p>
            <p className="mt-2 font-mono text-xs text-muted-foreground">
              Reg No: {profile.personal.registrationNumber ?? profile.personal.rollNumber}
            </p>
            {semesterLine ? <p className="text-xs text-muted-foreground">{semesterLine}</p> : null}
          </div>

          <Link href="/student/settings" className="hidden md:block">
            <Button variant="outline" size="sm" className="rounded-xl">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
          </Link>
        </div>

        <div className="mt-5 w-full max-w-md md:max-w-none">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-muted-foreground">Profile Completion</span>
            <span className="font-bold tabular-nums">{completion.percent}%</span>
          </div>
          <Progress value={completion.percent} className="mt-2 h-2.5" />
          {completion.missing.length ? (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Missing: {completion.missing.slice(0, 4).join(', ')}
              {completion.missing.length > 4 ? '…' : ''}
            </p>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 md:justify-start">
          {profile.rfid.assigned ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              RFID Assigned
            </span>
          ) : (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700">
              RFID Pending
            </span>
          )}
        </div>
      </div>
    </GlassCard>
  );
}

export function ProfileHeroMobileCompact({ profile }: { profile: StudentPortalProfile360 }) {
  const { completion } = profileDefaults(profile);
  const photoSrc = profile.personal.photoUrl
    ? resolveUploadAssetUrl(profile.personal.photoUrl)
    : null;

  return (
    <div className="flex items-center gap-3 md:hidden">
      {photoSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoSrc} alt="" className="h-14 w-14 rounded-xl border object-cover" />
      ) : (
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 font-bold text-primary">
          {profile.personal.enrollmentNumber.slice(-2)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">
          <StudentName
            name={profile.personal.fullName}
            displayFullName={profile.personal.displayFullName}
          />
        </p>
        <p className="truncate text-xs text-muted-foreground">{profile.academic.programme}</p>
        <p className="text-[11px] text-muted-foreground">
          Sem {profile.academic.semester ?? '—'} · {completion.percent}% complete
        </p>
      </div>
    </div>
  );
}
