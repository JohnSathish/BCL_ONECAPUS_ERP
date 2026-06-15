import type { CatalogSectionRow } from '@/types/academic-engine';

export function formatCatalogLabel(code: string, title: string) {
  return `${code} — ${title}`;
}

export function catalogOptionsForCategory(sections: CatalogSectionRow[], category: string) {
  const seen = new Set<string>();
  const options: { value: string; label: string; subjectSlug?: string | null }[] = [];

  for (const row of sections) {
    const cat = row.courseOffering.category ?? 'OTHER';
    if (cat !== category) continue;
    const code = row.courseOffering.course.code;
    if (seen.has(code)) continue;
    seen.add(code);
    options.push({
      value: code,
      label: formatCatalogLabel(code, row.courseOffering.course.title),
      subjectSlug: row.courseOffering.course.subjectSlug,
    });
  }

  return options.sort((a, b) => a.label.localeCompare(b.label));
}

export function formatLastSaved(at?: string | Date | null) {
  if (!at) return null;
  const d = typeof at === 'string' ? new Date(at) : at;
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function applicantDisplayName(app: {
  firstName: string;
  lastName?: string | null;
  formData?: Record<string, unknown>;
}) {
  const personal = app.formData?.personal as { fullName?: string } | undefined;
  if (personal?.fullName?.trim()) return personal.fullName.trim();
  return [app.firstName, app.lastName].filter(Boolean).join(' ').trim() || 'Applicant';
}

export function applicantPhotoUrl(
  documents?: { slotCode: string; fileUrl: string }[],
): string | null {
  const photo = documents?.find((d) => d.slotCode === 'PHOTO');
  return photo?.fileUrl ?? null;
}
