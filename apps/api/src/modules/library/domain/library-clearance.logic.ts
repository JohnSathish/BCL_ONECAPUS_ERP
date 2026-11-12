export const CLEARANCE_DECLARATION =
  'This is to certify that the above-mentioned student has returned all borrowed library books and cleared all outstanding library dues as per the library records.';

const ROMAN = [
  '',
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
  'XI',
  'XII',
];

export type ChecklistDecision = {
  status: 'PENDING' | 'CLEARED';
  booksReturned: 'YES' | 'NO';
  duesStatus: 'CLEARED' | 'PENDING';
  lostDamagedStatus: 'CLEARED' | 'PENDING';
  accountStatus: 'CLEARED' | 'NOT_CLEARED';
  remarks?: string | null;
};

export type LibraryCheckInput = {
  activeLoans: number;
  outstandingDues: number;
  openIncidents: number;
  membershipBlocked: boolean;
};

export type LibraryChecks = ChecklistDecision & {
  suggestedRemarks: string | null;
};

export function normalizeKey(value: string) {
  return value
    .trim()
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function semesterLabel(semester: number) {
  return ROMAN[semester] ?? String(semester);
}

export function yearCode(academicYear: string) {
  const years = academicYear.match(/\d{4}/g) ?? [];
  if (years.length >= 2) return `${years[0]}-${years[1]!.slice(-2)}`;
  if (years.length === 1) return years[0]!;
  const compact = academicYear.replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
  return (compact || 'YEAR').slice(0, 24);
}

export function formatCardNumber(academicYear: string, sequence: number) {
  return `LCC/${yearCode(academicYear)}/${String(sequence).padStart(5, '0')}`;
}

export function parseCardScan(raw: string) {
  const trimmed = raw.trim();
  const [cardNumber, token] = trimmed.split('|');
  return {
    cardNumber: (cardNumber ?? '').trim(),
    token: token?.trim() || null,
  };
}

export function formatMobile(value: string | null | undefined) {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  const local =
    digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  if (local.length === 10) return `${local.slice(0, 5)} ${local.slice(5)}`;
  return value.trim();
}

export function formatCardDate(isoDate: string | null | undefined) {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function checksAreClear(
  checks: Pick<
    ChecklistDecision,
    'booksReturned' | 'duesStatus' | 'lostDamagedStatus' | 'accountStatus'
  >,
) {
  return (
    checks.booksReturned === 'YES' &&
    checks.duesStatus === 'CLEARED' &&
    checks.lostDamagedStatus === 'CLEARED' &&
    checks.accountStatus === 'CLEARED'
  );
}

export function deriveLibraryChecks(input: LibraryCheckInput): LibraryChecks {
  const booksReturned = input.activeLoans > 0 ? 'NO' : 'YES';
  const duesStatus = input.outstandingDues > 0.009 ? 'PENDING' : 'CLEARED';
  const lostDamagedStatus = input.openIncidents > 0 ? 'PENDING' : 'CLEARED';
  const accountStatus =
    input.membershipBlocked ||
    booksReturned === 'NO' ||
    duesStatus === 'PENDING' ||
    lostDamagedStatus === 'PENDING'
      ? 'NOT_CLEARED'
      : 'CLEARED';
  const notes: string[] = [];
  if (input.activeLoans > 0) {
    notes.push(
      `${input.activeLoans} borrowed ${input.activeLoans === 1 ? 'book is' : 'books are'} still out`,
    );
  }
  if (input.outstandingDues > 0.009) {
    notes.push(`Outstanding library dues ₹${input.outstandingDues.toFixed(2)}`);
  }
  if (input.openIncidents > 0) {
    notes.push(
      `${input.openIncidents} lost or damaged ${input.openIncidents === 1 ? 'book case is' : 'book cases are'} still open`,
    );
  }
  if (input.membershipBlocked) notes.push('Library account is blocked');
  const status = accountStatus === 'CLEARED' ? 'CLEARED' : 'PENDING';
  return {
    status,
    booksReturned,
    duesStatus,
    lostDamagedStatus,
    accountStatus,
    suggestedRemarks: notes.length ? `${notes.join('. ')}.` : null,
  };
}

export function assertClearanceDecision(input: ChecklistDecision) {
  if (input.status === 'CLEARED' && !checksAreClear(input)) {
    return 'A cleared card needs every verification line marked clear.';
  }
  if (input.status === 'PENDING' && !input.remarks?.trim()) {
    return 'Add a remark explaining why clearance is pending.';
  }
  return null;
}

export function booksLabel(value: 'YES' | 'NO') {
  return value === 'YES' ? 'Yes' : 'No';
}

export function duesLabel(value: 'CLEARED' | 'PENDING') {
  return value === 'CLEARED' ? 'Cleared' : 'Pending';
}

export function accountLabel(value: 'CLEARED' | 'NOT_CLEARED') {
  return value === 'CLEARED' ? 'Cleared' : 'Not Cleared';
}

export function collegeHeader(branding: {
  displayName?: string | null;
  address?: string | null;
  portalSubtitle?: string | null;
}) {
  const name = (branding.displayName || 'Don Bosco College, Tura').trim();
  const address = (branding.address || '').trim();
  const subtitle = (branding.portalSubtitle || '').trim();
  const chunks = address
    .split(/\n|\||·/)
    .map((part) => part.trim())
    .filter(Boolean);
  const affiliationChunk = chunks.find((part) => /affiliated/i.test(part));
  let affiliation =
    affiliationChunk || (/affiliated/i.test(subtitle) ? subtitle : '');
  let place = chunks.filter((part) => part !== affiliationChunk).join(', ');
  if (!affiliation && /don bosco/i.test(name)) {
    affiliation = 'Affiliated to North-Eastern Hill University, Shillong';
  }
  if (!place && /don bosco/i.test(name)) {
    place = 'Tura, West Garo Hills, Meghalaya – 794002';
  }
  return {
    name: name.toUpperCase(),
    affiliation: affiliation.replace(/^\(|\)$/g, ''),
    place,
  };
}
