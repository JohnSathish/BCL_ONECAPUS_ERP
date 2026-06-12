import type { CertificateCategory } from '@/types/certificates';

export const CERTIFICATE_GROUP_LABELS: Record<string, string> = {
  ACADEMIC: 'Academic Certificates',
  MARKS: 'Marks & Transcripts',
  VERIFICATION: 'Student Services',
  TRAINING: 'Training & Workshops',
  ACHIEVEMENT: 'Activities & Achievements',
  PLACEMENT: 'Placement',
  RESEARCH: 'Research',
  CUSTOM: 'Custom',
};

export function groupCertificateCategories(categories: CertificateCategory[]) {
  const buckets = new Map<string, CertificateCategory[]>();
  for (const category of categories) {
    const group = category.group ?? 'CUSTOM';
    const list = buckets.get(group) ?? [];
    list.push(category);
    buckets.set(group, list);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, items]) => ({
      group,
      label: CERTIFICATE_GROUP_LABELS[group] ?? group.replace(/_/g, ' '),
      items: items.sort((a, b) => a.name.localeCompare(b.name)),
    }));
}
