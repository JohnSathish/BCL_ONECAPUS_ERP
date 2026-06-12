'use client';

import { createContext, useCallback, useContext, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { fetchStudentDisplaySettings } from '@/services/student-display-settings';
import { useAuth } from '@/hooks/use-auth';
import {
  DEFAULT_STUDENT_NAME_DISPLAY_FORMAT,
  formatStudentDisplayName,
  normalizeStudentNameDisplayFormat,
  studentDisplayInitials,
  type StudentNameDisplayFormat,
} from '@/utils/student-name-format';

type StudentNameFormatContextValue = {
  format: StudentNameDisplayFormat;
  formatStudentName: (name?: string | null) => string;
  studentInitials: (name?: string | null) => string;
  isLoading: boolean;
};

const StudentNameFormatContext = createContext<StudentNameFormatContextValue>({
  format: DEFAULT_STUDENT_NAME_DISPLAY_FORMAT,
  formatStudentName: (name) => formatStudentDisplayName(name, DEFAULT_STUDENT_NAME_DISPLAY_FORMAT),
  studentInitials: (name) => studentDisplayInitials(name, DEFAULT_STUDENT_NAME_DISPLAY_FORMAT),
  isLoading: false,
});

export function StudentNameFormatProvider({ children }: { children: React.ReactNode }) {
  const { session, isReady } = useAuth();
  const settings = useQuery({
    queryKey: ['settings', 'student-display'],
    queryFn: fetchStudentDisplaySettings,
    enabled: isReady && Boolean(session?.accessToken),
    staleTime: 5 * 60_000,
  });

  const format = normalizeStudentNameDisplayFormat(
    settings.data?.nameDisplayFormat ?? DEFAULT_STUDENT_NAME_DISPLAY_FORMAT,
  );

  const formatStudentName = useCallback(
    (name?: string | null) => formatStudentDisplayName(name, format),
    [format],
  );

  const studentInitials = useCallback(
    (name?: string | null) => studentDisplayInitials(name, format),
    [format],
  );

  const value = useMemo(
    () => ({
      format,
      formatStudentName,
      studentInitials,
      isLoading: settings.isLoading,
    }),
    [format, formatStudentName, studentInitials, settings.isLoading],
  );

  return (
    <StudentNameFormatContext.Provider value={value}>{children}</StudentNameFormatContext.Provider>
  );
}

export function useStudentNameFormat() {
  return useContext(StudentNameFormatContext);
}

/** Resolve display name from row fields or raw stored name. */
export function resolveStudentDisplayName(
  row: { displayFullName?: string | null; fullName?: string | null } | string | null | undefined,
  formatStudentName: (name?: string | null) => string,
): string {
  if (!row) return '';
  if (typeof row === 'string') return formatStudentName(row);
  if (row.displayFullName?.trim()) return row.displayFullName.trim();
  return formatStudentName(row.fullName);
}
