'use client';

import { User } from 'lucide-react';
import { useStudentNameFormat } from '@/components/providers/student-name-format-provider';
import { avatarColorClass } from '@/components/students-module/directory/directory-student-health';
import { resolveUploadAssetUrl } from '@/lib/branding-asset';
import type { StudentDirectoryRow } from '@/types/students';
import { cn } from '@/utils/cn';

export function DirectoryStudentAvatar({
  row,
  size = 'md',
  className,
}: {
  row: StudentDirectoryRow;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const { studentInitials } = useStudentNameFormat();
  const src = row.photoPath?.startsWith('blob:')
    ? row.photoPath
    : resolveUploadAssetUrl(row.photoPath);
  const sizeClass =
    size === 'lg' ? 'h-12 w-12 text-sm' : size === 'sm' ? 'h-7 w-7 text-[10px]' : 'h-9 w-9 text-xs';

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className={cn(
          'rounded-full object-cover ring-2 ring-background shadow-sm',
          sizeClass,
          className,
        )}
      />
    );
  }

  const initials = studentInitials(row.displayFullName ?? row.fullName);
  if (initials && initials !== '?') {
    return (
      <span
        className={cn(
          'inline-flex items-center justify-center rounded-full font-semibold ring-2 ring-background shadow-sm',
          avatarColorClass(row.fullName),
          sizeClass,
          className,
        )}
        aria-hidden
      >
        {initials}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-muted text-muted-foreground ring-1 ring-border/60',
        sizeClass,
        className,
      )}
    >
      <User className={size === 'lg' ? 'h-5 w-5' : 'h-3.5 w-3.5'} />
    </span>
  );
}
