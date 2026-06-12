import type { OfferingSectionStreamRef } from '@/types/programs';

/**
 * Label for delivery section stream eligibility in admin UI.
 * - No restriction (empty) → "All streams"
 * - Every active stream selected → "All streams"
 * - Otherwise → comma-separated stream names (e.g. "Science", "Arts, Commerce")
 */
export function formatEligibleStreamsLabel(
  eligibleStreams: OfferingSectionStreamRef[] | undefined,
  activeStreamCount: number,
): string {
  const selected = eligibleStreams ?? [];
  if (selected.length === 0) return 'All streams';
  if (activeStreamCount > 0 && selected.length >= activeStreamCount) {
    return 'All streams';
  }
  return [...selected]
    .map((r) => r.stream?.name ?? r.stream?.code ?? '')
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
    .join(', ');
}
