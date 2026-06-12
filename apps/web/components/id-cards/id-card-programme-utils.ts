/** Abbreviate long programme names for CR80 card space */
export function abbreviateProgramme(name: string | null | undefined): string | null {
  if (!name?.trim()) return null;
  const raw = name.trim();
  const lower = raw.toLowerCase();

  const inMatch = raw.match(/bachelor of arts in (.+)/i);
  if (inMatch) return `BA (${titleCase(inMatch[1])})`;

  const ofMatch = raw.match(/bachelor of (.+) in (.+)/i);
  if (ofMatch) {
    const degree = degreeAbbr(ofMatch[1]);
    return `${degree} (${titleCase(ofMatch[2])})`;
  }

  if (lower.startsWith('bachelor of arts')) return raw.replace(/bachelor of arts/i, 'BA');
  if (lower.startsWith('bachelor of science')) return raw.replace(/bachelor of science/i, 'BSc');
  if (lower.startsWith('bachelor of commerce')) return raw.replace(/bachelor of commerce/i, 'BCom');
  if (lower.startsWith('master of arts')) return raw.replace(/master of arts/i, 'MA');
  if (lower.startsWith('master of science')) return raw.replace(/master of science/i, 'MSc');

  if (raw.length > 28) return `${raw.slice(0, 26)}…`;
  return raw;
}

function degreeAbbr(field: string): string {
  const m: Record<string, string> = {
    arts: 'BA',
    science: 'BSc',
    commerce: 'BCom',
    education: 'BEd',
    technology: 'BTech',
  };
  return m[field.toLowerCase()] ?? field.slice(0, 3).toUpperCase();
}

function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Reject session/cycle text unsuitable for permanent ID cards */
export function isAcademicSessionText(text: string): boolean {
  return /\bfyugp\b|\bacademic year\b|\bay\s*20\d{2}\b|\bodd\b|\beven\b|\bsemester\b|\bsession\b|\bcycle\b/i.test(
    text,
  );
}

export function cleanInstitutionLocation(
  address: string | null | undefined,
  campus: string | null | undefined,
): string {
  const line = [campus, address].filter(Boolean).join(', ');
  if (!line) return '';
  const parts = line
    .split(/[,·]/)
    .map((p) => p.trim())
    .filter(Boolean);
  const unique: string[] = [];
  for (const p of parts) {
    if (
      !unique.some(
        (u) => u.toLowerCase() === p.toLowerCase() || u.toLowerCase().includes(p.toLowerCase()),
      )
    ) {
      unique.push(p);
    }
  }
  return unique.join(', ');
}
