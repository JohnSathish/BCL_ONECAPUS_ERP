export const CATEGORY_COLOR_TOKENS: Record<string, { pill: string; chip: string; dot: string }> = {
  MAJOR: {
    pill: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300',
    chip: 'border-blue-500/40 bg-blue-500/15 text-blue-800 dark:text-blue-200',
    dot: 'bg-blue-500',
  },
  MINOR: {
    pill: 'border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300',
    chip: 'border-purple-500/40 bg-purple-500/15 text-purple-800 dark:text-purple-200',
    dot: 'bg-purple-500',
  },
  MDC: {
    pill: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
    chip: 'border-cyan-500/40 bg-cyan-500/15 text-cyan-800 dark:text-cyan-200',
    dot: 'bg-cyan-500',
  },
  AEC: {
    pill: 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300',
    chip: 'border-green-500/40 bg-green-500/15 text-green-800 dark:text-green-200',
    dot: 'bg-green-500',
  },
  SEC: {
    pill: 'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300',
    chip: 'border-orange-500/40 bg-orange-500/15 text-orange-800 dark:text-orange-200',
    dot: 'bg-orange-500',
  },
  VAC: {
    pill: 'border-pink-500/30 bg-pink-500/10 text-pink-700 dark:text-pink-300',
    chip: 'border-pink-500/40 bg-pink-500/15 text-pink-800 dark:text-pink-200',
    dot: 'bg-pink-500',
  },
  VTC: {
    pill: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
    chip: 'border-red-500/40 bg-red-500/15 text-red-800 dark:text-red-200',
    dot: 'bg-red-500',
  },
  INTERNSHIP: {
    pill: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-800 dark:text-yellow-200',
    chip: 'border-yellow-500/40 bg-yellow-500/15 text-yellow-900 dark:text-yellow-100',
    dot: 'bg-yellow-500',
  },
  RESEARCH: {
    pill: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
    chip: 'border-indigo-500/40 bg-indigo-500/15 text-indigo-800 dark:text-indigo-200',
    dot: 'bg-indigo-500',
  },
  PROJECT: {
    pill: 'border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300',
    chip: 'border-teal-500/40 bg-teal-500/15 text-teal-800 dark:text-teal-200',
    dot: 'bg-teal-500',
  },
  DISSERTATION: {
    pill: 'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300',
    chip: 'border-violet-500/40 bg-violet-500/15 text-violet-800 dark:text-violet-200',
    dot: 'bg-violet-500',
  },
  ELECTIVE: {
    pill: 'border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300',
    chip: 'border-slate-500/40 bg-slate-500/15 text-slate-800 dark:text-slate-200',
    dot: 'bg-slate-500',
  },
  OPEN_ELECTIVE: {
    pill: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300',
    chip: 'border-zinc-500/40 bg-zinc-500/15 text-zinc-800 dark:text-zinc-200',
    dot: 'bg-zinc-500',
  },
};

const FALLBACK = {
  pill: 'border-border/60 bg-muted/40 text-foreground',
  chip: 'border-border/60 bg-muted/50 text-foreground',
  dot: 'bg-muted-foreground',
};

export function categoryColorToken(category: string) {
  return CATEGORY_COLOR_TOKENS[category] ?? FALLBACK;
}

export const ROMAN_SEMESTERS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'] as const;

export function semesterRoman(n: number): string {
  return ROMAN_SEMESTERS[n - 1] ?? String(n);
}
