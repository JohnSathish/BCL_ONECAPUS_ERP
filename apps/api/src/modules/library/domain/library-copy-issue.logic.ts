import {
  COPY_TYPES,
  type CopyIssueRules,
  type CopyType,
} from './library-policy.types';

export function isCopyType(
  value: string | null | undefined,
): value is CopyType {
  return Boolean(value && (COPY_TYPES as readonly string[]).includes(value));
}

export function copyTypeForBookType(
  bookType: string | null | undefined,
): CopyType {
  const value = bookType?.trim().toUpperCase() ?? '';
  return isCopyType(value) ? value : 'GENERAL';
}

export function copyTypeLabel(copyType: string | null | undefined): string {
  switch (copyType) {
    case 'GENERAL':
      return 'General Book';
    case 'REFERENCE':
      return 'Reference Book';
    case 'RARE':
      return 'Rare Book';
    case 'TEXTBOOK':
      return 'Textbook';
    case 'RESERVE':
      return 'Reserve Book';
    case 'RESTRICTED':
      return 'Restricted Book';
    case 'OTHER':
      return 'Other';
    default:
      return 'Not set';
  }
}

export function issueBlockMessage(copyType: string | null | undefined): string {
  if (copyType === 'REFERENCE') {
    return 'This is a Reference Book. Issue is not permitted.';
  }
  if (copyType === 'RARE') {
    return 'This is a Rare Book. Issue is not permitted.';
  }
  if (copyType === 'RESTRICTED') {
    return 'This is a Restricted Book. Issue is not permitted.';
  }
  if (copyType === 'RESERVE') {
    return 'This is a Reserve Book. Issue is not permitted.';
  }
  if (copyType === 'TEXTBOOK') {
    return 'This textbook copy cannot be issued.';
  }
  return 'Issue is not permitted for this copy.';
}

export function resolveCopyIssue(input: {
  copyType?: string | null;
  issueAllowed?: boolean | null;
  categoryCode?: string | null;
  copyIssue: CopyIssueRules;
  referenceAllow: boolean;
  rareAllow: boolean;
}): { allowed: boolean; message: string | null; copyType: string | null } {
  const type = isCopyType(input.copyType) ? input.copyType : null;
  if (input.issueAllowed === false) {
    return { allowed: false, message: issueBlockMessage(type), copyType: type };
  }
  if (input.issueAllowed === true) {
    return { allowed: true, message: null, copyType: type };
  }
  if (type) {
    const allowed = input.copyIssue[type];
    return {
      allowed,
      message: allowed ? null : issueBlockMessage(type),
      copyType: type,
    };
  }
  const code = input.categoryCode?.toUpperCase() ?? '';
  if (
    (code === 'REFERENCE' || code.includes('REFERENCE')) &&
    !input.referenceAllow
  ) {
    return {
      allowed: false,
      message: issueBlockMessage('REFERENCE'),
      copyType: null,
    };
  }
  if ((code === 'RARE' || code.includes('RARE')) && !input.rareAllow) {
    return {
      allowed: false,
      message: issueBlockMessage('RARE'),
      copyType: null,
    };
  }
  return { allowed: true, message: null, copyType: null };
}
