import type { CatalogSectionRow } from '@/types/academic-engine';
import { slotCategory } from '@/utils/semester-rules';

export type AssignedSubjectRow = {
  slotKey: string;
  category: string;
  pathName?: string;
  section?: CatalogSectionRow;
  assignmentMode: 'auto' | 'manual';
  badgeLabel?: string;
  helperText?: string;
};

export function parseCredits(value: string | number | null | undefined): number {
  if (value == null || value === '') return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function formatCredits(value: string | number | null | undefined): string {
  const n = parseCredits(value);
  return n === 1 ? '1 Credit' : `${n} Credits`;
}

export function formatAssignmentMode(mode: 'auto' | 'manual'): string {
  return mode === 'auto' ? 'Auto-assigned' : 'Manually selected';
}

export function formatCourseLine(section: CatalogSectionRow): string {
  const course = section.courseOffering.course;
  return `${course.code} — ${course.title}`;
}

export function formatAssignmentMeta(section: CatalogSectionRow, mode: 'auto' | 'manual'): string {
  const parts = [
    formatCredits(section.courseOffering.course.credits),
    section.sectionCode ? `Section ${section.sectionCode}` : null,
    formatAssignmentMode(mode),
  ].filter(Boolean);
  return parts.join(' • ');
}

export function mappingSourceLabel(source?: string | null): string {
  if (!source) return 'Direct curriculum';
  if (source === 'SHARED_POOL') return 'Shared pool';
  if (source === 'DIRECT') return 'Direct curriculum';
  return source
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function assignmentDebugMeta(section: CatalogSectionRow): {
  mappingSource: string;
  poolName?: string;
  sectionCode?: string;
  majorPaperIndex?: number | null;
  offeringId: string;
} {
  const offering = section.courseOffering;
  return {
    mappingSource: mappingSourceLabel(offering.mappingSource ?? section.mappingSource),
    poolName: section.poolName,
    sectionCode: section.sectionCode,
    majorPaperIndex: offering.majorPaperIndex,
    offeringId: offering.id,
  };
}

export function detectDuplicateCourseCodes(sections: Array<CatalogSectionRow | undefined>): {
  hasDuplicates: boolean;
  duplicateCodes: string[];
} {
  const seen = new Map<string, number>();
  for (const section of sections) {
    if (!section) continue;
    const code = section.courseOffering.course.code;
    seen.set(code, (seen.get(code) ?? 0) + 1);
  }
  const duplicateCodes = [...seen.entries()].filter(([, count]) => count > 1).map(([code]) => code);
  return { hasDuplicates: duplicateCodes.length > 0, duplicateCodes };
}

export function buildAssignedSubjectRows(input: {
  slotKeys: string[];
  autoSlotKeys: string[];
  selections: Record<string, string>;
  catalog: CatalogSectionRow[];
  resolveSection: (slotKey: string) => CatalogSectionRow | undefined;
  pathNames?: Record<string, string>;
}): AssignedSubjectRow[] {
  const autoSet = new Set(input.autoSlotKeys);
  return input.slotKeys
    .map((slotKey) => {
      const category = slotCategory(slotKey);
      const sectionId = input.selections[slotKey];
      const section =
        (sectionId ? input.catalog.find((row) => row.id === sectionId) : undefined) ??
        input.resolveSection(slotKey);
      return {
        slotKey,
        category,
        pathName: input.pathNames?.[category],
        section,
        assignmentMode: autoSet.has(slotKey) ? ('auto' as const) : ('manual' as const),
      };
    })
    .filter((row) => row.section || autoSet.has(row.slotKey));
}
