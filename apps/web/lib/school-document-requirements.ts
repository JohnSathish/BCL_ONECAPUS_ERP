/**
 * Configurable K.G. certificate rules (community / category → document slots).
 * Keep in sync with apps/api school-document-requirements.ts
 *
 * Parents declare the CHILD'S Caste/Category and Community/Tribe only.
 * The system derives which parent's certificate (if any) must be uploaded.
 */

export const SCHOOL_CONDITIONAL_SLOT_CODES = [
  'CASTE_CERT',
  'MOTHER_ST_CERT',
  'FATHER_SC_OBC_CERT',
] as const;

export type SchoolConditionalSlotCode = (typeof SCHOOL_CONDITIONAL_SLOT_CODES)[number];

export type SchoolDocumentRequirementRule = {
  id: string;
  slotCode: SchoolConditionalSlotCode;
  label: string;
  helperText: string;
  communities?: string[];
  categories?: string[];
  required: boolean;
};

export type SchoolDocumentRequirementsConfig = {
  rules: SchoolDocumentRequirementRule[];
};

/** School-correct defaults for K.G. Admission 2027 (Word form + SC + General verify). */
export const DEFAULT_SCHOOL_DOCUMENT_REQUIREMENTS: SchoolDocumentRequirementsConfig = {
  rules: [
    {
      id: 'caste_cert_for_general',
      slotCode: 'CASTE_CERT',
      label: 'Caste Certificate',
      helperText:
        'Required for General / UR candidates. Please upload a clear copy of the caste certificate issued by a competent authority so the school can verify the category.',
      categories: ['GENERAL_UR'],
      required: true,
    },
    {
      id: 'mother_st_for_st_tribes',
      slotCode: 'MOTHER_ST_CERT',
      label: 'Mother’s ST Certificate',
      helperText:
        'Required for Garo, Khasi and Jaintia candidates. Please upload a clear copy of the mother’s original Scheduled Tribe certificate.',
      categories: ['ST'],
      communities: ['Garo', 'Khasi', 'Jaintia'],
      required: true,
    },
    {
      id: 'father_sc_for_sc',
      slotCode: 'FATHER_SC_OBC_CERT',
      label: 'Father’s SC Certificate',
      helperText:
        'Required for SC candidates. Please upload a clear copy of the father’s original SC certificate.',
      categories: ['SC'],
      required: true,
    },
    {
      id: 'father_obc_for_obc',
      slotCode: 'FATHER_SC_OBC_CERT',
      label: 'Father’s OBC Certificate',
      helperText:
        'Required for OBC candidates. Please upload a clear copy of the father’s original OBC certificate.',
      categories: ['OBC'],
      required: true,
    },
  ],
};

export type SchoolApplicableCertificate = {
  ruleId: string;
  slotCode: SchoolConditionalSlotCode;
  label: string;
  helperText: string;
  required: boolean;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Detect the pre-fix default rule set that incorrectly required both
 * Mother ST and Father SC/OBC for ST + Garo/Khasi/Jaintia applicants.
 */
export function isLegacySchoolDocumentRequirements(
  rules: SchoolDocumentRequirementRule[],
): boolean {
  if (rules.length !== 2) return false;
  const byId = new Map(rules.map((r) => [r.id, r]));
  const mother = byId.get('mother_st_for_tribes');
  const father = byId.get('father_sc_obc_for_st_obc');
  if (!mother || !father) return false;

  const motherCats = (mother.categories ?? []).map((c) => c.toUpperCase());
  const fatherCats = (father.categories ?? []).map((c) => c.toUpperCase()).sort();
  const motherCommunities = (mother.communities ?? []).map(normalizeToken).sort();
  const expectedCommunities = ['garo', 'jaintia', 'khasi'];

  const motherIsCommunityOnly =
    mother.slotCode === 'MOTHER_ST_CERT' &&
    motherCats.length === 0 &&
    motherCommunities.join(',') === expectedCommunities.join(',');

  const fatherIncludesStAndObc =
    father.slotCode === 'FATHER_SC_OBC_CERT' && fatherCats.join(',') === 'OBC,ST';

  return motherIsCommunityOnly && fatherIncludesStAndObc;
}

/**
 * Detect the short-lived defaults that omitted General / UR caste verification.
 */
export function isMissingGeneralCasteDocumentRequirements(
  rules: SchoolDocumentRequirementRule[],
): boolean {
  if (rules.length !== 3) return false;
  const ids = rules.map((r) => r.id).sort();
  return ids.join(',') === 'father_obc_for_obc,father_sc_for_sc,mother_st_for_st_tribes';
}

export function normalizeSchoolDocumentRequirements(
  value: unknown,
): SchoolDocumentRequirementsConfig {
  const fallback = DEFAULT_SCHOOL_DOCUMENT_REQUIREMENTS;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return structuredClone(fallback);
  }
  const rulesRaw = (value as { rules?: unknown }).rules;
  if (!Array.isArray(rulesRaw) || rulesRaw.length === 0) {
    return structuredClone(fallback);
  }
  const rules: SchoolDocumentRequirementRule[] = [];
  for (const item of rulesRaw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const slotCode = text(row.slotCode);
    if (!(SCHOOL_CONDITIONAL_SLOT_CODES as readonly string[]).includes(slotCode)) {
      continue;
    }
    const id = text(row.id) || `${slotCode}-${rules.length + 1}`;
    const label = text(row.label);
    const helperText = text(row.helperText);
    if (!label) continue;
    const communities = Array.isArray(row.communities)
      ? row.communities
          .filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
          .map((c) => c.trim())
      : undefined;
    const categories = Array.isArray(row.categories)
      ? row.categories
          .filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
          .map((c) => c.trim().toUpperCase())
      : undefined;
    rules.push({
      id,
      slotCode: slotCode as SchoolConditionalSlotCode,
      label,
      helperText:
        helperText ||
        fallback.rules.find((r) => r.id === id)?.helperText ||
        fallback.rules.find((r) => r.slotCode === slotCode)?.helperText ||
        '',
      communities: communities?.length ? communities : undefined,
      categories: categories?.length ? categories : undefined,
      required: row.required !== false,
    });
  }
  if (!rules.length) return structuredClone(fallback);
  if (
    isLegacySchoolDocumentRequirements(rules) ||
    isMissingGeneralCasteDocumentRequirements(rules)
  ) {
    return structuredClone(fallback);
  }
  return { rules };
}

function ruleMatches(
  rule: SchoolDocumentRequirementRule,
  child: Record<string, unknown>,
  categoryCode: string | null,
): boolean {
  const hasCommunityGate = Boolean(rule.communities?.length);
  const hasCategoryGate = Boolean(rule.categories?.length);
  if (!hasCommunityGate && !hasCategoryGate) return false;

  let communityOk = true;
  if (hasCommunityGate) {
    const community = normalizeToken(text(child.community));
    if (!community) return false;
    communityOk = rule.communities!.some((name) => normalizeToken(name) === community);
  }

  let categoryOk = true;
  if (hasCategoryGate) {
    if (!categoryCode) return false;
    categoryOk = rule.categories!.some((code) => code.toUpperCase() === categoryCode.toUpperCase());
  }

  return communityOk && categoryOk;
}

export function resolveApplicableSchoolCertificates(
  formData: Record<string, unknown> | null | undefined,
  options?: {
    categoryCode?: string | null;
    documentRequirements?: unknown;
  },
): SchoolApplicableCertificate[] {
  const child = asRecord(formData?.child);
  const categoryCode =
    options?.categoryCode ?? (typeof child.category === 'string' ? child.category.trim() : null);
  const config = normalizeSchoolDocumentRequirements(options?.documentRequirements);

  return config.rules
    .filter((rule) => ruleMatches(rule, child, categoryCode))
    .map((rule) => ({
      ruleId: rule.id,
      slotCode: rule.slotCode,
      label: rule.label,
      helperText: rule.helperText,
      required: rule.required !== false,
    }));
}

export function schoolConditionalSlotLabel(
  slotCode: string,
  documentRequirements?: unknown,
): string | null {
  const config = normalizeSchoolDocumentRequirements(documentRequirements);
  return config.rules.find((rule) => rule.slotCode === slotCode)?.label ?? null;
}
