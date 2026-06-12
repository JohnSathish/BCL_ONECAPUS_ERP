'use client';

import Link from 'next/link';
import { User } from 'lucide-react';

import { DirectorySemesterChip } from '@/components/students-module/directory/ui/directory-semester-chip';
import { DirectoryStatusPill } from '@/components/students-module/directory/ui/directory-status-pill';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { resolveUploadAssetUrl } from '@/lib/branding-asset';
import type { StudentDirectoryRow } from '@/types/students';
import { StudentName } from '@/components/students/student-name';

type Props = {
  row: StudentDirectoryRow;
  children: React.ReactNode;
};

export function DirectoryStudentHoverCard({ row, children }: Props) {
  const src = row.photoPath?.startsWith('blob:')
    ? row.photoPath
    : resolveUploadAssetUrl(row.photoPath);
  const statusLabel = row.studentStatus ?? row.academicStatus;

  return (
    <HoverCard openDelay={300} closeDelay={100}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent side="top" className="w-72">
        <div className="flex gap-3">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt=""
              className="h-12 w-12 rounded-full object-cover ring-2 ring-primary/20"
            />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground ring-2 ring-primary/20">
              <User className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <StudentName
              name={row.fullName}
              displayFullName={row.displayFullName}
              className="truncate font-semibold"
            />
            <p className="truncate text-xs text-muted-foreground">{row.programme ?? '—'}</p>
            <div className="mt-1.5 flex items-center gap-2">
              <DirectorySemesterChip semester={row.semester} />
              <DirectoryStatusPill label={statusLabel} />
            </div>
          </div>
        </div>
        <div className="mt-3 flex gap-2 border-t border-border/60 pt-3">
          <Link
            href={`/admin/students/${row.id}`}
            className="text-xs font-medium text-primary hover:underline"
          >
            View profile
          </Link>
          <Link
            href={`/admin/students/subject-registration?student=${row.id}`}
            className="text-xs font-medium text-muted-foreground hover:text-primary hover:underline"
          >
            Assign subjects
          </Link>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
