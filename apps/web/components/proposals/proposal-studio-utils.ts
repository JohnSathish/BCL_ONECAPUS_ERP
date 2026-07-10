import type { ProposalCustomization } from '@/types/proposals';

export type StudioStepId =
  | 'institution'
  | 'branding'
  | 'modules'
  | 'pricing'
  | 'preview'
  | 'export';

export const STUDIO_STEPS: Array<{ id: StudioStepId; label: string }> = [
  { id: 'institution', label: 'Institution' },
  { id: 'branding', label: 'Branding' },
  { id: 'modules', label: 'Modules' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'preview', label: 'Preview' },
  { id: 'export', label: 'Export' },
];

export const PAGE_NAV_SECTIONS = [
  { key: 'cover', label: 'Cover' },
  { key: 'executive-summary', label: 'Executive Summary' },
  { key: 'architecture', label: 'Modules' },
  { key: 'subscription', label: 'Pricing' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'terms', label: 'Terms' },
  { key: 'acceptance', label: 'Acceptance' },
] as const;

export function computeStepStatus(
  form: ProposalCustomization,
  hasPreview: boolean,
): Record<StudioStepId, 'complete' | 'current' | 'pending'> {
  const institutionDone = Boolean(form.institutionName?.trim() && form.contactPerson?.trim());
  const brandingDone = Boolean(form.primaryColor && form.logoUrl);
  const modulesDone = (form.sectionToggles ?? []).some((s) => s.enabled);
  const pricingDone = (form.pricingLines ?? []).length > 0 && (form.studentStrength ?? 0) > 0;
  const previewDone = hasPreview;
  const exportDone = hasPreview;

  const flags = [institutionDone, brandingDone, modulesDone, pricingDone, previewDone, exportDone];
  const firstIncomplete = flags.findIndex((f) => !f);

  return {
    institution: firstIncomplete === 0 ? 'current' : institutionDone ? 'complete' : 'pending',
    branding: firstIncomplete === 1 ? 'current' : brandingDone ? 'complete' : 'pending',
    modules: firstIncomplete === 2 ? 'current' : modulesDone ? 'complete' : 'pending',
    pricing: firstIncomplete === 3 ? 'current' : pricingDone ? 'complete' : 'pending',
    preview: firstIncomplete === 4 ? 'current' : previewDone ? 'complete' : 'pending',
    export: firstIncomplete === 5 ? 'current' : exportDone ? 'complete' : 'pending',
  };
}

export function computeProposalStats(html: string) {
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = text ? text.split(' ').filter(Boolean).length : 14200;
  const pages = (html.match(/class="page"/g) ?? []).length || 13;
  const images = (html.match(/<img\b/gi) ?? []).length || 8;
  const tables = (html.match(/<table\b/gi) ?? []).length || 4;

  return { pages, words, images, tables, printReady: pages >= 10 && pages <= 18 };
}

export type ProposalScore = {
  overall: number;
  branding: number;
  readability: number;
  printReady: number;
};

export function computeProposalScore(
  form: ProposalCustomization,
  stats: ReturnType<typeof computeProposalStats>,
): ProposalScore {
  const branding =
    (form.institutionName ? 25 : 0) +
    (form.logoUrl ? 25 : 0) +
    (form.primaryColor ? 25 : 0) +
    (form.backgroundImageUrl ? 25 : 0);
  const readability =
    (form.copyOverrides?.executiveSummary ? 35 : 20) +
    (form.contactPerson ? 20 : 0) +
    (stats.words > 8000 ? 25 : 15) +
    (stats.tables >= 10 ? 20 : 10);
  const printReady = stats.printReady ? 95 : 70;
  const overall = Math.round((branding + readability + printReady) / 3);

  return {
    overall: Math.min(100, overall),
    branding: Math.min(100, branding),
    readability: Math.min(100, readability),
    printReady: Math.min(100, printReady),
  };
}

export function starsFromScore(score: number) {
  if (score >= 90) return 5;
  if (score >= 75) return 4;
  if (score >= 60) return 3;
  if (score >= 45) return 2;
  return 1;
}
