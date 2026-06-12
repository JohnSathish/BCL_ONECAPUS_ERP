import type { Program } from '@/types/programs';

/** Maps published program version id → owning academic department id. */
export function buildProgramVersionDepartmentMap(
  programs: Program[] | undefined,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const program of programs ?? []) {
    const departmentId = program.department?.id ?? program.departmentId ?? undefined;
    if (!departmentId) continue;
    for (const version of program.versions ?? []) {
      if (version.status === 'PUBLISHED') {
        map[version.id] = departmentId;
      }
    }
  }
  return map;
}

export function resolveDepartmentIdForProgramVersion(
  programVersionId: string,
  map: Record<string, string | undefined>,
): string | undefined {
  if (!programVersionId) return undefined;
  return map[programVersionId];
}
