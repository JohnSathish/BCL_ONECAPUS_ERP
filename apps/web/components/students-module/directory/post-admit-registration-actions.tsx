'use client';

import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';

import { Button, buttonVariants } from '@/components/ui/button';
import {
  bulkGenerateRegistrations,
  fetchStudentRegistrationContext,
} from '@/services/admin-registration';
import type { StudentProfile } from '@/types/students';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

type Props = {
  profile: StudentProfile;
  onDone?: () => void;
};

export function PostAdmitRegistrationActions({ profile, onDone }: Props) {
  const context = useQuery({
    queryKey: ['admin-registrations', 'context', profile.id],
    queryFn: () => fetchStudentRegistrationContext(profile.id),
  });

  const generateMut = useMutation({
    mutationFn: async () => {
      const ctx = context.data ?? (await fetchStudentRegistrationContext(profile.id));
      if (!ctx.semesterId) {
        throw new Error('No active semester found for this student.');
      }
      return bulkGenerateRegistrations({
        semesterId: ctx.semesterId,
        semesterSequence: ctx.semesterSequence,
        mode: 'COMPULSORY_ONLY',
        studentIds: [profile.id],
      });
    },
  });

  const semesterLabel = context.data?.semesterSequence ?? profile.semester;
  const result = generateMut.data?.results?.[0];

  return (
    <div className="space-y-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-sm">
      <p className="font-medium text-emerald-900 dark:text-emerald-100">
        {profile.fullName} admitted successfully
      </p>
      <p className="text-muted-foreground">
        Semester {semesterLabel} · You can auto-assign compulsory subjects now or continue in the
        registration workspace.
      </p>
      {generateMut.isError ? (
        <p className="text-xs text-destructive">
          {apiErrorMessage(generateMut.error, 'Compulsory registration failed')}
        </p>
      ) : null}
      {result?.ok ? (
        <p className="text-xs text-emerald-800 dark:text-emerald-200">
          Compulsory subjects assigned ({result.status ?? 'draft'}).
        </p>
      ) : result && !result.ok ? (
        <p className="text-xs text-destructive">{result.error ?? 'Assignment failed'}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={generateMut.isPending || context.isLoading}
          onClick={() => generateMut.mutate()}
        >
          {generateMut.isPending ? 'Assigning…' : 'Generate compulsory registration'}
        </Button>
        <Link
          href={`/admin/students/subject-registration?student=${profile.id}`}
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        >
          Open subject registration
        </Link>
        {onDone ? (
          <Button type="button" size="sm" variant="ghost" onClick={onDone}>
            Done
          </Button>
        ) : null}
      </div>
    </div>
  );
}
