'use client';

import {
  resolveStudentDisplayName,
  useStudentNameFormat,
} from '@/components/providers/student-name-format-provider';
import { cn } from '@/utils/cn';

type StudentNameProps = {
  name?: string | null;
  displayFullName?: string | null;
  className?: string;
  as?: 'span' | 'p' | 'div';
  title?: string;
};

export function StudentName({
  name,
  displayFullName,
  className,
  as: Tag = 'span',
  title,
}: StudentNameProps) {
  const { formatStudentName } = useStudentNameFormat();
  const text = displayFullName?.trim()
    ? displayFullName.trim()
    : resolveStudentDisplayName({ displayFullName, fullName: name }, formatStudentName);

  return (
    <Tag className={cn(className)} title={title ?? (name && name !== text ? name : undefined)}>
      {text || '—'}
    </Tag>
  );
}
