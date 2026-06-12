import type { CatalogSectionRow } from '@/types/academic-engine';
import type { AdmissionPoolOffering, AdmissionPoolsResponse } from '@/types/students';
import {
  assignMajorPaperSlots,
  requiredMajorPaperCount,
  resolveMajorPaperForSlot,
} from '@/utils/major-paper-assignment';
import {
  buildAutoSlotKeysFromRule,
  buildSelectableSlotKeysFromRule,
  buildSlotKeysFromRule,
  categorySlotKeys,
  isAutoAssignedCategory,
  slotCategory,
} from '@/utils/semester-rules';

export { categorySlotKeys as categoryKeys, slotCategory, isAutoAssignedCategory };

export function slugifySubject(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

export function isElectiveSlotKey(key: string, electiveCategories: string[]): boolean {
  const base = slotCategory(key);
  return electiveCategories.includes(base);
}

function getCategoryCounts(pools?: AdmissionPoolsResponse, semesterSequence = 1) {
  if (!pools) return {};
  const rule = pools.structureRules.find((r) => r.semesterSequence === semesterSequence);
  if (rule) return rule.categoryCounts;
  if (pools.semesterRule?.categoryCounts) return pools.semesterRule.categoryCounts;
  return pools.categoryCounts;
}

export function buildSlotKeys(pools?: AdmissionPoolsResponse, semesterSequence = 1) {
  if (!pools) return [];
  const rule = pools.structureRules.find((r) => r.semesterSequence === semesterSequence);
  if (rule) return categorySlotKeys(rule.categoryCounts);
  if (pools.semesterRule?.categoryCounts) {
    return categorySlotKeys(pools.semesterRule.categoryCounts);
  }
  return categorySlotKeys(pools.categoryCounts);
}

export function buildAutoSlotKeys(pools?: AdmissionPoolsResponse, semesterSequence = 1) {
  if (!pools) return [];
  const rule = pools.structureRules.find((r) => r.semesterSequence === semesterSequence);
  if (rule) return buildAutoSlotKeysFromRule(rule);
  if (pools.semesterRule) return buildAutoSlotKeysFromRule(pools.semesterRule);
  return buildAutoSlotKeysFromRule({ categoryCounts: pools.categoryCounts });
}

export function buildSelectableSlotKeys(pools?: AdmissionPoolsResponse, semesterSequence = 1) {
  if (!pools) return [];
  const rule = pools.structureRules.find((r) => r.semesterSequence === semesterSequence);
  if (rule) return buildSelectableSlotKeysFromRule(rule);
  if (pools.semesterRule) return buildSelectableSlotKeysFromRule(pools.semesterRule);
  return buildSelectableSlotKeysFromRule({ categoryCounts: pools.categoryCounts });
}

function courseSubjectSlug(course: {
  subjectSlug?: string | null;
  department?: { name?: string | null } | null;
  title?: string | null;
  code?: string | null;
}): string {
  if (course.subjectSlug?.trim()) return slugifySubject(course.subjectSlug);
  if (course.department?.name?.trim()) return slugifySubject(course.department.name);
  if (course.title?.trim()) return slugifySubject(course.title);
  if (course.code?.trim()) return slugifySubject(course.code);
  return '';
}

function catalogCourseId(row: CatalogSectionRow): string {
  const course = row.courseOffering.course as { id?: string; code: string };
  return course.id ?? course.code;
}

function catalogRowsForMajorPath(
  catalog: CatalogSectionRow[],
  pools: AdmissionPoolsResponse | undefined,
  subjectSlug: string,
): CatalogSectionRow[] {
  const target = subjectSlug ? slugifySubject(subjectSlug) : '';

  const poolOfferings = subjectSlug
    ? (pools?.major ?? []).filter((o) => courseSubjectSlug(o.course ?? {}) === target)
    : [];

  const poolOfferingIds = new Set(
    poolOfferings.flatMap((o) => [o.id, o.offeringId].filter(Boolean) as string[]),
  );
  const poolCourseCodes = new Set(
    poolOfferings.map((o) => o.course?.code).filter(Boolean) as string[],
  );

  const slugMatches = catalog.filter((row) => {
    if (row.courseOffering.category !== 'MAJOR') return false;
    if (!subjectSlug) return true;
    const rowSlug = courseSubjectSlug(row.courseOffering.course);
    if (rowSlug === target) return true;
    return poolCourseCodes.has(row.courseOffering.course.code);
  });

  let matches = slugMatches;
  if (poolOfferingIds.size > 0) {
    const byPoolId = slugMatches.filter((row) => poolOfferingIds.has(row.courseOffering.id));
    if (byPoolId.length > 0) matches = byPoolId;
  }

  const byCourseId = new Map<string, CatalogSectionRow>();
  for (const row of matches) {
    const courseId = catalogCourseId(row);
    if (!byCourseId.has(courseId)) byCourseId.set(courseId, row);
  }
  return [...byCourseId.values()];
}

/** Resolve a catalog section from saved slot selections first, then path rules. */
export function resolveSectionForSlotWithSelections(
  catalog: CatalogSectionRow[],
  pools: AdmissionPoolsResponse | undefined,
  slotKey: string,
  selections: Record<string, string>,
  majorSubjectSlug: string,
  minorSubjectSlug: string,
  semesterSequence = 1,
): CatalogSectionRow | undefined {
  const selectedId = selections[slotKey];
  if (selectedId) {
    const bySelection = catalog.find((row) => row.id === selectedId);
    if (bySelection) return bySelection;
  }
  return resolveSectionForSlot(
    catalog,
    pools,
    slotKey,
    majorSubjectSlug,
    minorSubjectSlug,
    semesterSequence,
  );
}

function toMajorPaperRow(row: CatalogSectionRow) {
  return {
    majorPaperIndex: row.courseOffering.majorPaperIndex,
    displayOrder: null as number | null,
    courseId: catalogCourseId(row),
    course: { code: row.courseOffering.course.code },
    section: row,
  };
}

/** Resolve unique major paper sections for a subject path (batch assignment). */
export function resolveMajorPaperSectionsForPath(
  catalog: CatalogSectionRow[],
  pools: AdmissionPoolsResponse | undefined,
  subjectSlug: string,
  requiredCount: number,
): CatalogSectionRow[] {
  const rows = catalogRowsForMajorPath(catalog, pools, subjectSlug);
  const assigned = assignMajorPaperSlots(rows.map(toMajorPaperRow), requiredCount);
  return assigned.map((row) => row.section);
}

function findPoolOffering(
  offerings: AdmissionPoolOffering[],
  subjectSlug: string,
): AdmissionPoolOffering | undefined {
  const target = slugifySubject(subjectSlug);
  return offerings.find((o) => courseSubjectSlug(o.course ?? {}) === target);
}

/** Resolve a catalog section for a major/minor path chosen in Academic Details. */
export function resolveSectionForPath(
  catalog: CatalogSectionRow[],
  pools: AdmissionPoolsResponse | undefined,
  category: 'MAJOR' | 'MINOR',
  subjectSlug: string,
  paperIndex?: number,
  requiredMajorCount?: number,
): CatalogSectionRow | undefined {
  if (!subjectSlug) return undefined;

  if (
    category === 'MAJOR' &&
    requiredMajorCount != null &&
    requiredMajorCount > 1 &&
    paperIndex != null
  ) {
    const sections = resolveMajorPaperSectionsForPath(
      catalog,
      pools,
      subjectSlug,
      requiredMajorCount,
    );
    return sections[paperIndex - 1];
  }

  const poolRows = category === 'MAJOR' ? (pools?.major ?? []) : (pools?.minor ?? []);
  const offering = findPoolOffering(poolRows, subjectSlug);
  if (offering?.id) {
    const byOffering = catalog.find(
      (row) =>
        row.courseOffering.category === category &&
        (row.courseOffering.id === offering.id || row.courseOffering.id === offering.offeringId) &&
        (paperIndex == null || row.courseOffering.majorPaperIndex === paperIndex),
    );
    if (byOffering) return byOffering;
  }

  const target = slugifySubject(subjectSlug);
  const matches = catalog.filter((row) => {
    if (row.courseOffering.category !== category) return false;
    if (courseSubjectSlug(row.courseOffering.course) !== target) return false;
    if (paperIndex == null) return true;
    return row.courseOffering.majorPaperIndex === paperIndex;
  });
  return matches[0];
}

export function resolveSectionForSlot(
  catalog: CatalogSectionRow[],
  pools: AdmissionPoolsResponse | undefined,
  slotKey: string,
  majorSubjectSlug: string,
  minorSubjectSlug: string,
  semesterSequence = 1,
): CatalogSectionRow | undefined {
  const category = slotCategory(slotKey);
  if (category !== 'MAJOR' && category !== 'MINOR') return undefined;
  const slug = category === 'MAJOR' ? majorSubjectSlug : minorSubjectSlug;
  const paperIndex = slotKey.includes('-') ? Number(slotKey.split('-')[1]) : undefined;
  const requiredMajorCount =
    category === 'MAJOR'
      ? requiredMajorPaperCount(getCategoryCounts(pools, semesterSequence))
      : undefined;

  return resolveSectionForPath(
    catalog,
    pools,
    category,
    slug,
    Number.isFinite(paperIndex) ? paperIndex : undefined,
    requiredMajorCount,
  );
}

export function bindAutoAssignedSelections(
  current: Record<string, string>,
  autoSlotKeys: string[],
  catalog: CatalogSectionRow[],
  pools: AdmissionPoolsResponse | undefined,
  majorSubjectSlug: string,
  minorSubjectSlug: string,
  semesterSequence = 1,
): Record<string, string> {
  const next = { ...current };
  const categoryCounts = getCategoryCounts(pools, semesterSequence);
  const majorCount = requiredMajorPaperCount(categoryCounts);

  if (majorCount > 1 && majorSubjectSlug) {
    const majorSections = resolveMajorPaperSectionsForPath(
      catalog,
      pools,
      majorSubjectSlug,
      majorCount,
    );
    for (let i = 0; i < majorCount; i++) {
      const slotKey = `MAJOR-${i + 1}`;
      const section = majorSections[i];
      if (section) next[slotKey] = section.id;
      else delete next[slotKey];
    }
  }

  for (const slotKey of autoSlotKeys) {
    const category = slotCategory(slotKey);
    if (category === 'MAJOR' && majorCount > 1) continue;

    const section = resolveSectionForSlot(
      catalog,
      pools,
      slotKey,
      majorSubjectSlug,
      minorSubjectSlug,
      semesterSequence,
    );
    if (section) next[slotKey] = section.id;
    else delete next[slotKey];
  }
  return next;
}

export function majorPaperOptionsForSlot(
  catalog: CatalogSectionRow[],
  pools: AdmissionPoolsResponse | undefined,
  subjectSlug: string,
  slotIndex: number,
  requiredCount: number,
  usedCourseIds: Set<string>,
): CatalogSectionRow[] {
  const rows = catalogRowsForMajorPath(catalog, pools, subjectSlug).map(toMajorPaperRow);
  const picked = resolveMajorPaperForSlot(rows, slotIndex, usedCourseIds);
  return picked ? [picked.section] : [];
}
