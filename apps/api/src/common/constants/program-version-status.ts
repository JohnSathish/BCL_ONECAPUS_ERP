export const PROGRAM_VERSION_STATUSES = [
  'DRAFT',
  'PUBLISHED',
  'ARCHIVED',
] as const;

export type ProgramVersionStatus = (typeof PROGRAM_VERSION_STATUSES)[number];

export function isProgramVersionStatus(
  value: string,
): value is ProgramVersionStatus {
  return (PROGRAM_VERSION_STATUSES as readonly string[]).includes(value);
}
