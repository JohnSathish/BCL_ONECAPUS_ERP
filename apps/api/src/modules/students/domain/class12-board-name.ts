/** True when the stored Class XII board choice is the Others option. */
export function isOthersClass12Board(board?: string | null): boolean {
  const raw = String(board ?? '')
    .trim()
    .toUpperCase();
  return raw === 'OTHERS' || raw === 'OTHER';
}

/**
 * Label used for board-wise counts. Others uses the typed board name.
 * Named boards stay on their existing value.
 */
export function class12BoardReportLabel(
  boardName?: string | null,
  boardNameOther?: string | null,
): string {
  if (isOthersClass12Board(boardName)) {
    const named = String(boardNameOther ?? '').trim();
    return named || 'Others';
  }
  return String(boardName ?? '').trim();
}
