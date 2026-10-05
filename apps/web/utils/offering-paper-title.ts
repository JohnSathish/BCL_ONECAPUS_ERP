/** Paper name for a curriculum mapping. Falls back to the course master title. */
export function offeringPaperTitle(
  course: { title?: string | null } | null | undefined,
  offering?: { titleOverride?: string | null } | null,
): string {
  const override = offering?.titleOverride?.trim();
  if (override) return override;
  return course?.title?.trim() ?? '';
}
