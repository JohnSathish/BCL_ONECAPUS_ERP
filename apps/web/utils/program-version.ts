import type { Program, ProgramVersion, ProgramVersionStatus } from '@/types/programs';

function versionStatus(v: ProgramVersion): ProgramVersionStatus {
  return v.status ?? 'PUBLISHED';
}

export function getPublishedVersion(versions: ProgramVersion[]): ProgramVersion | undefined {
  return versions.find((v) => versionStatus(v) === 'PUBLISHED');
}

export function getDraftVersion(versions: ProgramVersion[]): ProgramVersion | undefined {
  return versions.find((v) => versionStatus(v) === 'DRAFT');
}

export function programCurriculumSummary(program: Program): {
  currentVersion: ProgramVersion | null;
  statusLabel: string;
  hasDraft: boolean;
} {
  const published = getPublishedVersion(program.versions);
  const draft = getDraftVersion(program.versions);
  const currentVersion = published ?? draft ?? program.versions[0] ?? null;

  let statusLabel = 'No curriculum';
  if (published) statusLabel = 'Active';
  else if (draft) statusLabel = 'Draft pending';
  else if (currentVersion?.status === 'ARCHIVED') statusLabel = 'Archived only';

  return {
    currentVersion,
    statusLabel,
    hasDraft: Boolean(draft),
  };
}

export function versionStatusLabel(status: ProgramVersionStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'Draft';
    case 'PUBLISHED':
      return 'Published';
    case 'ARCHIVED':
      return 'Archived';
    default:
      return status;
  }
}

export function versionUsageTotal(usage?: ProgramVersion['usage']): number {
  if (!usage) return 0;
  return (
    usage.offerings +
    usage.students +
    usage.registrations +
    usage.outcomeRuns +
    usage.approvalPolicies +
    (usage.poolAssignments ?? 0) +
    (usage.semesterRules ?? 0) +
    (usage.deliverySections ?? 0) +
    (usage.staffAssignments ?? 0) +
    (usage.programOutcomes ?? 0)
  );
}

/** Usage that blocks purge/delete (students, registrations, policies, OBE). */
export function versionHardUsageTotal(usage?: ProgramVersion['usage']): number {
  if (!usage) return 0;
  return usage.students + usage.registrations + usage.outcomeRuns + usage.approvalPolicies;
}

export function versionCurriculumUsageTotal(usage?: ProgramVersion['usage']): number {
  if (!usage) return 0;
  return (
    usage.offerings +
    (usage.poolAssignments ?? 0) +
    (usage.semesterRules ?? 0) +
    (usage.deliverySections ?? 0) +
    (usage.staffAssignments ?? 0) +
    (usage.programOutcomes ?? 0)
  );
}
