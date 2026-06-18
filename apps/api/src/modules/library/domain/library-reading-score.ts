export type ReadingScoreInput = {
  visitCount: number;
  totalLoans: number;
  onTimeReturns: number;
  activeMember?: boolean;
};

export type ReadingScoreResult = {
  overall: number;
  visitsPoints: number;
  loansPoints: number;
  onTimePoints: number;
  membershipPoints: number;
};

export function computeReadingScore(
  input: ReadingScoreInput,
): ReadingScoreResult {
  const visitsPoints = Math.min(40, input.visitCount * 4);
  const loansPoints = Math.min(30, input.totalLoans * 3);
  const onTimeRatio =
    input.totalLoans > 0 ? input.onTimeReturns / input.totalLoans : 1;
  const onTimePoints = Math.round(Math.min(20, onTimeRatio * 20));
  const membershipPoints = input.activeMember !== false ? 10 : 0;
  const overall = Math.min(
    100,
    visitsPoints + loansPoints + onTimePoints + membershipPoints,
  );
  return { overall, visitsPoints, loansPoints, onTimePoints, membershipPoints };
}

export function tokenizeForMatch(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

const STOP_WORDS = new Set([
  'department',
  'dept',
  'and',
  'the',
  'for',
  'studies',
  'programme',
  'program',
  'honours',
  'honors',
  'general',
  'paper',
]);

export function matchScore(haystack: string, needles: string[]): number {
  const h = haystack.toLowerCase();
  let score = 0;
  for (const needle of needles) {
    const n = needle.toLowerCase().trim();
    if (!n || n.length < 3) continue;
    if (h.includes(n)) score += 10;
    else {
      for (const token of tokenizeForMatch(n)) {
        if (h.includes(token)) score += 4;
      }
    }
  }
  return score;
}
