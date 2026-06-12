import {
  computeHasFaculty,
  computeMappingStatus,
} from '../../programs-courses/domain/curriculum-offering-list.helpers';
import type { CategoryMeta } from './fyugp-templates';
import {
  CATEGORY_DISPLAY_ORDER,
  type CompletionCellInput,
  type CompletionCellResult,
  type CompletionIssueType,
  type CompletionOfferingSnapshot,
  type CompletionQuickAction,
  type CompletionStatus,
  type CompletionMissingItem,
} from './curriculum-completion.types';

export function sortCategories(categories: string[]): string[] {
  return [...categories].sort((a, b) => {
    const ia = CATEGORY_DISPLAY_ORDER.indexOf(
      a as (typeof CATEGORY_DISPLAY_ORDER)[number],
    );
    const ib = CATEGORY_DISPLAY_ORDER.indexOf(
      b as (typeof CATEGORY_DISPLAY_ORDER)[number],
    );
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
}

export function rollupStatus(statuses: CompletionStatus[]): CompletionStatus {
  if (!statuses.length) return 'NOT_CONFIGURED';
  if (statuses.every((s) => s === 'COMPLETE')) return 'COMPLETE';
  if (statuses.every((s) => s === 'NOT_CONFIGURED')) return 'NOT_CONFIGURED';
  return 'PARTIAL';
}

function allOfferings(
  input: CompletionCellInput,
): CompletionOfferingSnapshot[] {
  return [...input.directOfferings, ...input.poolOfferings];
}

function hasCreditMismatch(
  offerings: CompletionOfferingSnapshot[],
  expectedCredits?: number | null,
): boolean {
  if (expectedCredits == null || expectedCredits <= 0) return false;
  return offerings.some((o) => o.course.credits !== expectedCredits);
}

function hasMappingGap(offerings: CompletionOfferingSnapshot[]): boolean {
  return offerings.some((o) => {
    const status = computeMappingStatus(
      o.sections.map((s) => ({
        sectionCode: s.sectionCode,
        shiftId: s.shiftId,
        capacity: s.capacity,
        staffProfileId: s.staffProfileId,
        subjectAssignments: s.subjectAssignments,
      })),
    );
    return status !== 'FULL';
  });
}

function countFacultyGaps(offerings: CompletionOfferingSnapshot[]): number {
  let gaps = 0;
  for (const offering of offerings) {
    for (const section of offering.sections) {
      const hasFaculty = computeHasFaculty([
        {
          sectionCode: section.sectionCode,
          shiftId: section.shiftId,
          capacity: section.capacity,
          staffProfileId: section.staffProfileId,
          subjectAssignments: section.subjectAssignments,
        },
      ]);
      if (!hasFaculty) gaps += 1;
    }
  }
  return gaps;
}

export function evaluateCompletionCell(
  input: CompletionCellInput,
): CompletionCellResult {
  const directCount = input.directOfferings.length;
  const poolCount = input.poolOfferings.length;
  const actual = directCount + poolCount;
  const issues: CompletionIssueType[] = [];

  if (!input.hasStructureRule) {
    issues.push('MISSING_STRUCTURE');
  }

  if (
    input.isPoolEligible &&
    input.required > 0 &&
    !input.poolAssigned &&
    directCount === 0
  ) {
    issues.push('MISSING_POOL');
  }

  if (input.required > 0 && actual === 0) {
    if (input.isPoolEligible && !input.poolAssigned) {
      // already flagged
    } else if (!input.isPoolEligible) {
      issues.push('MISSING_MAPPING');
    } else {
      issues.push('MISSING_CATEGORY');
    }
  } else if (actual > 0 && actual < input.required) {
    issues.push('MISSING_CATEGORY');
  }

  const offerings = allOfferings(input);
  if (offerings.length > 0 && hasMappingGap(offerings)) {
    issues.push('MISSING_SECTION');
  }

  if (hasCreditMismatch(offerings, input.expectedCredits)) {
    issues.push('MISSING_CREDITS');
  }

  for (const offering of offerings) {
    for (const section of offering.sections) {
      const hasFaculty = computeHasFaculty([
        {
          sectionCode: section.sectionCode,
          shiftId: section.shiftId,
          capacity: section.capacity,
          staffProfileId: section.staffProfileId,
          subjectAssignments: section.subjectAssignments,
        },
      ]);
      if (!hasFaculty) {
        issues.push('MISSING_FACULTY');
        break;
      }
    }
    if (issues.includes('MISSING_FACULTY')) break;
  }

  let status: CompletionStatus;
  if (
    !input.hasStructureRule ||
    (input.required > 0 && actual === 0) ||
    (input.isPoolEligible &&
      input.required > 0 &&
      !input.poolAssigned &&
      directCount === 0)
  ) {
    status = 'NOT_CONFIGURED';
  } else if (
    actual < input.required ||
    hasMappingGap(offerings) ||
    hasCreditMismatch(offerings, input.expectedCredits) ||
    (input.isPoolEligible &&
      input.poolAssigned &&
      poolCount === 0 &&
      directCount === 0)
  ) {
    status = 'PARTIAL';
  } else {
    status = 'COMPLETE';
  }

  return {
    category: input.category,
    required: input.required,
    actual,
    directCount,
    poolCount,
    status,
    poolAssigned: input.poolAssigned,
    issues: [...new Set(issues)],
  };
}

export function issueToQuickAction(
  issue: CompletionIssueType,
): CompletionQuickAction {
  switch (issue) {
    case 'MISSING_POOL':
      return 'ADD_SHARED_POOL';
    case 'MISSING_SECTION':
      return 'CREATE_SECTION';
    case 'MISSING_FACULTY':
      return 'ASSIGN_FACULTY';
    case 'MISSING_MAPPING':
    case 'MISSING_CATEGORY':
    case 'MISSING_CREDITS':
      return 'CREATE_MAPPING';
    case 'MISSING_STRUCTURE':
      return 'CREATE_MAPPING';
    default:
      return 'ADD_COURSE';
  }
}

export function buildMissingItemsFromCell(params: {
  programVersionId: string;
  programCode: string;
  programName: string;
  semesterSequence: number;
  cell: CompletionCellResult;
  directOfferings: CompletionOfferingSnapshot[];
  poolOfferings: CompletionOfferingSnapshot[];
}): CompletionMissingItem[] {
  const items: CompletionMissingItem[] = [];
  const { cell } = params;

  for (const issue of cell.issues) {
    if (issue === 'MISSING_FACULTY') {
      for (const offering of [
        ...params.directOfferings,
        ...params.poolOfferings,
      ]) {
        for (const section of offering.sections) {
          const hasFaculty = computeHasFaculty([
            {
              sectionCode: section.sectionCode,
              shiftId: section.shiftId,
              capacity: section.capacity,
              staffProfileId: section.staffProfileId,
              subjectAssignments: section.subjectAssignments,
            },
          ]);
          if (!hasFaculty) {
            items.push({
              programVersionId: params.programVersionId,
              programCode: params.programCode,
              programName: params.programName,
              semesterSequence: params.semesterSequence,
              category: cell.category,
              issueType: issue,
              courseCode: offering.course.code,
              courseTitle: offering.course.title,
              offeringId: offering.id,
              sectionId: section.id,
              message: `Section ${section.sectionCode} has no faculty assigned`,
              quickAction: 'ASSIGN_FACULTY',
            });
          }
        }
      }
      continue;
    }

    if (issue === 'MISSING_SECTION') {
      for (const offering of [
        ...params.directOfferings,
        ...params.poolOfferings,
      ]) {
        const mappingStatus = computeMappingStatus(
          offering.sections.map((s) => ({
            sectionCode: s.sectionCode,
            shiftId: s.shiftId,
            capacity: s.capacity,
            staffProfileId: s.staffProfileId,
            subjectAssignments: s.subjectAssignments,
          })),
        );
        if (mappingStatus !== 'FULL') {
          items.push({
            programVersionId: params.programVersionId,
            programCode: params.programCode,
            programName: params.programName,
            semesterSequence: params.semesterSequence,
            category: cell.category,
            issueType: issue,
            courseCode: offering.course.code,
            courseTitle: offering.course.title,
            offeringId: offering.id,
            message: `${offering.course.code} mapping is ${mappingStatus.toLowerCase().replace('_', ' ')}`,
            quickAction: 'CREATE_SECTION',
          });
        }
      }
      continue;
    }

    items.push({
      programVersionId: params.programVersionId,
      programCode: params.programCode,
      programName: params.programName,
      semesterSequence: params.semesterSequence,
      category: cell.category,
      issueType: issue,
      message: missingIssueMessage(issue, cell),
      quickAction: issueToQuickAction(issue),
    });
  }

  return items;
}

function missingIssueMessage(
  issue: CompletionIssueType,
  cell: CompletionCellResult,
): string {
  switch (issue) {
    case 'MISSING_CATEGORY':
      return `${cell.category}: ${cell.actual}/${cell.required} courses configured`;
    case 'MISSING_POOL':
      return `${cell.category}: shared pool not assigned for this programme`;
    case 'MISSING_MAPPING':
      return `${cell.category}: no curriculum mapping`;
    case 'MISSING_CREDITS':
      return `${cell.category}: course credits do not match expected rule`;
    case 'MISSING_STRUCTURE':
      return `Semester ${cell.category}: no FYUGP structure rule`;
    default:
      return `${cell.category}: setup incomplete`;
  }
}

export function expectedCreditsForCategory(
  categoryMeta: CategoryMeta | undefined,
  category: string,
): number | null {
  const entry = categoryMeta?.[category];
  return entry?.creditRule ?? null;
}

export function countUnmappedOfferings(
  directOfferings: CompletionOfferingSnapshot[],
  poolOfferings: CompletionOfferingSnapshot[],
): number {
  let count = 0;
  for (const offering of [...directOfferings, ...poolOfferings]) {
    const status = computeMappingStatus(
      offering.sections.map((s) => ({
        sectionCode: s.sectionCode,
        shiftId: s.shiftId,
        capacity: s.capacity,
        staffProfileId: s.staffProfileId,
        subjectAssignments: s.subjectAssignments,
      })),
    );
    if (status === 'UNMAPPED') count += 1;
  }
  return count;
}

export function countFacultyGapsInOfferings(
  directOfferings: CompletionOfferingSnapshot[],
  poolOfferings: CompletionOfferingSnapshot[],
): number {
  return countFacultyGaps([...directOfferings, ...poolOfferings]);
}
