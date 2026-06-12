'use client';

import Link from 'next/link';
import { Download, QrCode } from 'lucide-react';

import { GlassCard } from '@/components/erp/glass-card';
import { Button } from '@/components/ui/button';
import { StudentName } from '@/components/students/student-name';
import { resolveUploadAssetUrl } from '@/lib/branding-asset';
import type { LibraryQrPass } from '@/types/library';
import type { StudentPortalProfile360 } from '@/types/student-portal-profile';

type Props = {
  profile: StudentPortalProfile360;
  qrPass?: LibraryQrPass | null;
};

export function ProfileIdentityCard({ profile, qrPass }: Props) {
  const photoSrc = profile.personal.photoUrl
    ? resolveUploadAssetUrl(profile.personal.photoUrl)
    : null;

  return (
    <GlassCard className="p-5">
      <h2 className="text-sm font-semibold tracking-tight">Digital Student ID</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Show at library, exams, and campus checkpoints
      </p>

      <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        {photoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoSrc} alt="" className="h-20 w-20 rounded-xl border object-cover" />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-primary/10 text-xl font-bold text-primary">
            {profile.personal.enrollmentNumber.slice(-2)}
          </div>
        )}

        {qrPass?.qrImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrPass.qrImageUrl}
            alt="Student QR code"
            className="h-24 w-24 rounded-xl border border-border/60 bg-white p-1"
          />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/30">
            <QrCode className="h-10 w-10 text-muted-foreground/40" />
          </div>
        )}

        <dl className="min-w-0 flex-1 space-y-1.5 text-sm">
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Name</dt>
            <dd className="font-semibold">
              <StudentName
                name={profile.personal.fullName}
                displayFullName={profile.personal.displayFullName}
              />
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">RFID</dt>
            <dd className="font-mono text-xs">{profile.rfid.rfidNumber ?? 'Not assigned'}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Registration
            </dt>
            <dd className="font-mono text-xs">
              {profile.personal.registrationNumber ?? profile.personal.rollNumber}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Academic Year
            </dt>
            <dd>{profile.academic.academicYear ?? '—'}</dd>
          </div>
        </dl>
      </div>

      <Button asChild className="mt-4 w-full rounded-xl" size="sm">
        <Link href="/student/id-card">
          <Download className="mr-2 h-4 w-4" />
          View &amp; Request ID Card
        </Link>
      </Button>
    </GlassCard>
  );
}
