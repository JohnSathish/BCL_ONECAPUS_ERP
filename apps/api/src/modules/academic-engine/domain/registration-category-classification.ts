export type AssignMode = 'COMPULSORY_ONLY' | 'ALL_CATEGORIES';

export type BulkGenerateMode =
  | 'DRAFT_ONLY'
  | 'COMPULSORY_ONLY'
  | 'PREPARE_ELECTIVES'
  | 'FULL';

/** Categories always auto-assigned regardless of workflow electives list. */
export const ALWAYS_AUTO_ASSIGNED = new Set([
  'MAJOR',
  'MINOR',
  'INTERNSHIP',
  'DISSERTATION',
  'PROJECT',
  'RESEARCH',
]);

export function mandatoryFlagForCategory(
  category: string,
  ruleLines: { categoryType: string; mandatoryFlag: boolean }[],
): boolean {
  const line = ruleLines.find((l) => l.categoryType === category);
  if (line) return line.mandatoryFlag;
  return ALWAYS_AUTO_ASSIGNED.has(category);
}

export function isStudentChoiceCategory(
  category: string,
  mandatoryFlag: boolean,
  studentElectiveCategories: string[],
): boolean {
  if (ALWAYS_AUTO_ASSIGNED.has(category)) return false;
  if (!mandatoryFlag) return true;
  return studentElectiveCategories.includes(category);
}

export function shouldAutoAssignCategory(
  category: string,
  mandatoryFlag: boolean,
  studentElectiveCategories: string[],
  assignMode: AssignMode,
): boolean {
  if (assignMode === 'ALL_CATEGORIES') return true;
  return !isStudentChoiceCategory(
    category,
    mandatoryFlag,
    studentElectiveCategories,
  );
}

export function unfilledElectiveSlots(
  categoryCounts: Record<string, number>,
  ruleLines: { categoryType: string; mandatoryFlag: boolean }[],
  studentElectiveCategories: string[],
  filledByCategory: Record<string, number>,
): { category: string; required: number; filled: number; remaining: number }[] {
  const slots: {
    category: string;
    required: number;
    filled: number;
    remaining: number;
  }[] = [];
  for (const [category, count] of Object.entries(categoryCounts)) {
    const mandatory = mandatoryFlagForCategory(category, ruleLines);
    if (
      !isStudentChoiceCategory(category, mandatory, studentElectiveCategories)
    ) {
      continue;
    }
    const filled = filledByCategory[category] ?? 0;
    if (filled < count) {
      slots.push({
        category,
        required: count,
        filled,
        remaining: count - filled,
      });
    }
  }
  return slots;
}
