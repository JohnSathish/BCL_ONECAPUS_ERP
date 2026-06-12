import type {
  CatalogSectionRow,
  CatalogWithEligibility,
  IneligibleCatalogSection,
} from '@/types/academic-engine';

export function isCatalogWithEligibility(data: unknown): data is CatalogWithEligibility {
  if (!data || typeof data !== 'object') return false;
  const record = data as Record<string, unknown>;
  return (
    'eligible' in record &&
    'ineligible' in record &&
    Array.isArray(record.eligible) &&
    Array.isArray(record.ineligible)
  );
}

export function normalizeCatalogResponse(
  data: CatalogSectionRow[] | CatalogWithEligibility,
): CatalogWithEligibility {
  if (isCatalogWithEligibility(data)) return data;
  return { eligible: data ?? [], ineligible: [] };
}

export function buildSectionsByCategory(
  eligible: CatalogSectionRow[],
): Map<string, CatalogSectionRow[]> {
  const map = new Map<string, CatalogSectionRow[]>();
  for (const row of eligible) {
    const cat = row.courseOffering.category ?? 'OTHER';
    const list = map.get(cat) ?? [];
    list.push(row);
    map.set(cat, list);
  }
  return map;
}

export function ineligibleForCategory(
  ineligible: IneligibleCatalogSection[],
  category: string,
): IneligibleCatalogSection[] {
  return ineligible.filter((row) => (row.section.courseOffering.category ?? 'OTHER') === category);
}

export function ineligibleSectionIds(ineligible: IneligibleCatalogSection[]): Set<string> {
  return new Set(ineligible.map((row) => row.section.id));
}

export function ineligibleReasonForSection(
  ineligible: IneligibleCatalogSection[],
  sectionId: string,
): string | undefined {
  const row = ineligible.find((item) => item.section.id === sectionId);
  return row?.reasons[0];
}
