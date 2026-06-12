/** Section with zero eligible streams is open to all streams. */
export function isSectionOpenToAllStreams(
  eligibleStreamIds: string[] | undefined | null,
): boolean {
  return !eligibleStreamIds || eligibleStreamIds.length === 0;
}

export function isStudentEligibleForSection(
  studentStreamId: string | null | undefined,
  eligibleStreamIds: string[] | undefined | null,
): boolean {
  if (isSectionOpenToAllStreams(eligibleStreamIds)) return true;
  if (!studentStreamId) return false;
  return eligibleStreamIds!.includes(studentStreamId);
}

export const STREAM_INELIGIBLE_MESSAGE =
  'This course is not available for your academic stream.';

export function formatStreamIneligibleMessage(input: {
  courseCode: string;
  courseTitle: string;
  category: string;
  sectionCode: string;
  studentStreamLabel: string;
  allowedStreamLabels: string[];
}): string {
  const allowed =
    input.allowedStreamLabels.length > 0
      ? input.allowedStreamLabels.join(', ')
      : 'none configured (open to all streams when empty)';
  return (
    `${input.courseCode} — ${input.courseTitle} (${input.category}, Section ${input.sectionCode}) ` +
    `is not available for the student's stream "${input.studentStreamLabel}". ` +
    `Allowed streams on this section: ${allowed}. ` +
    `Update eligible streams in Course Master → Programme curriculum → section settings.`
  );
}
