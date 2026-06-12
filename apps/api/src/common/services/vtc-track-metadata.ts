export type VtcTrackMetadata = {
  vtcTrackGroupCode: string | null;
  vtcTrackStage: number | null;
};

const ROMAN_STAGE: Record<string, number> = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
  V: 5,
};

/** Parse VTC course code/title into track group + stage (I/II/III). */
export function parseVtcTrackMetadata(
  code: string,
  title?: string | null,
): VtcTrackMetadata {
  const normalizedCode = code.trim().toUpperCase();
  const normalizedTitle = (title ?? '').trim();

  let group: string | null = null;
  let stage: number | null = null;

  const codeNumeric = normalizedCode.match(/^VTC[-\s]?(\d+(?:\.\d+)?)/);
  if (codeNumeric) {
    group = codeNumeric[1]!;
    const stageFromCode = inferStageFromSuffix(normalizedCode, normalizedTitle);
    if (stageFromCode) stage = stageFromCode;
  }

  const titleNumeric = normalizedTitle.match(/(\d+(?:\.\d+)?)/);
  if (!group && titleNumeric) {
    group = titleNumeric[1]!;
  }

  const slugGroup = inferNamedTrackGroup(normalizedTitle);
  if (slugGroup) {
    group = group ?? slugGroup;
  }

  if (!stage) {
    stage = inferStageFromSuffix(normalizedCode, normalizedTitle);
  }

  if (stage != null && (stage < 1 || stage > 5)) {
    stage = null;
  }

  return {
    vtcTrackGroupCode: group,
    vtcTrackStage: stage,
  };
}

function inferNamedTrackGroup(title: string): string | null {
  const lower = title.toLowerCase();
  const patterns: Array<[RegExp, string]> = [
    [/desktop\s+publishing/, 'DESKTOP_PUBLISHING'],
    [/bee\s+keeping/, 'BEE_KEEPING'],
    [/web\s+design/, 'WEB_DESIGNING'],
    [/event\s+management/, 'EVENT_MANAGEMENT'],
  ];
  for (const [re, code] of patterns) {
    if (re.test(lower)) return code;
  }
  return null;
}

function inferStageFromSuffix(code: string, title: string): number | null {
  const combined = `${code} ${title}`.toUpperCase();
  const roman = combined.match(/\b(I{1,3}|IV|V)\b(?:\s*$|[^A-Z])/);
  if (roman) {
    return ROMAN_STAGE[roman[1]!] ?? null;
  }
  const dashStage = combined.match(/[-\s]([123])\s*$/);
  if (dashStage) {
    return Number(dashStage[1]);
  }
  return null;
}

/** Merge explicit VTC fields with parsed metadata; explicit values win. */
export function resolveVtcTrackFields(input: {
  code: string;
  title?: string | null;
  vtcTrackGroupCode?: string | null;
  vtcTrackStage?: number | null;
}): VtcTrackMetadata {
  const parsed = parseVtcTrackMetadata(input.code, input.title);
  return {
    vtcTrackGroupCode:
      input.vtcTrackGroupCode?.trim() || parsed.vtcTrackGroupCode,
    vtcTrackStage:
      input.vtcTrackStage != null && input.vtcTrackStage > 0
        ? input.vtcTrackStage
        : parsed.vtcTrackStage,
  };
}

export function expectedVtcStageForSemester(
  semesterSequence: number,
): number | null {
  if (semesterSequence === 3) return 1;
  if (semesterSequence === 4) return 2;
  if (semesterSequence === 6) return 3;
  return null;
}
