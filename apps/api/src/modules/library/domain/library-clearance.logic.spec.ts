import { renderClearanceCardsHtml } from './library-clearance-card.html';
import {
  assertClearanceDecision,
  collegeHeader,
  deriveLibraryChecks,
  formatCardDate,
  formatCardNumber,
  formatMobile,
  normalizeKey,
  parseCardScan,
  semesterLabel,
  yearCode,
} from './library-clearance.logic';

describe('library clearance rules', () => {
  it('suggests a cleared account only when books, dues and incidents are clear', () => {
    expect(
      deriveLibraryChecks({
        activeLoans: 0,
        outstandingDues: 0,
        openIncidents: 0,
        membershipBlocked: false,
      }).status,
    ).toBe('CLEARED');

    const pending = deriveLibraryChecks({
      activeLoans: 2,
      outstandingDues: 25,
      openIncidents: 1,
      membershipBlocked: true,
    });
    expect(pending.status).toBe('PENDING');
    expect(pending.booksReturned).toBe('NO');
    expect(pending.duesStatus).toBe('PENDING');
    expect(pending.lostDamagedStatus).toBe('PENDING');
    expect(pending.accountStatus).toBe('NOT_CLEARED');
    expect(pending.suggestedRemarks).toContain('2 borrowed books');
  });

  it('refuses a cleared decision while a checklist line is still open', () => {
    expect(
      assertClearanceDecision({
        status: 'CLEARED',
        booksReturned: 'NO',
        duesStatus: 'CLEARED',
        lostDamagedStatus: 'CLEARED',
        accountStatus: 'CLEARED',
      }),
    ).toMatch(/every verification line/i);
    expect(
      assertClearanceDecision({
        status: 'PENDING',
        booksReturned: 'NO',
        duesStatus: 'PENDING',
        lostDamagedStatus: 'CLEARED',
        accountStatus: 'NOT_CLEARED',
        remarks: 'Two books are still out.',
      }),
    ).toBeNull();
  });

  it('builds a stable card number and treats dashed academic years as the same key', () => {
    expect(yearCode('2026 – 2027')).toBe('2026-27');
    expect(formatCardNumber('2026-2027', 3458)).toBe('LCC/2026-27/03458');
    expect(normalizeKey('2026 – 2027')).toBe(normalizeKey('2026-2027'));
    expect(semesterLabel(3)).toBe('III');
    expect(formatMobile('9365678901')).toBe('93656 78901');
    expect(formatCardDate('2026-11-11')).toBe('11 Nov 2026');
    expect(parseCardScan('LCC/2026-27/03458|abc').token).toBe('abc');
  });

  it('keeps the Don Bosco header when branding has not stored an address', () => {
    const header = collegeHeader({ displayName: 'Don Bosco College, Tura' });
    expect(header.name).toBe('DON BOSCO COLLEGE, TURA');
    expect(header.affiliation).toMatch(/North-Eastern Hill University/);
    expect(header.place).toMatch(/Tura/);
  });

  it('prints the certificate only on a cleared card', () => {
    const base = {
      collegeName: 'DON BOSCO COLLEGE, TURA',
      affiliation: 'Affiliated to North-Eastern Hill University, Shillong',
      place: 'Tura, West Garo Hills, Meghalaya – 794002',
      logoDataUri: null,
      cardNumber: 'LCC/2026-27/03458',
      examinationName: 'FYUGP 3rd Semester Examination',
      academicYear: '2026 – 2027',
      semesterLabel: 'III',
      studentName: 'Jona M. Sangma',
      rollNumber: 'BA25-458',
      registrationNumber: '25034578',
      programme: 'B.A. (FYUGP)',
      department: 'English',
      academicSession: '2025 – 2029',
      mobileNumber: '93656 78901',
      booksReturned: 'YES' as const,
      duesStatus: 'CLEARED' as const,
      lostDamagedStatus: 'CLEARED' as const,
      accountStatus: 'CLEARED' as const,
      status: 'CLEARED' as const,
      remarks: '',
      librarianName: 'Library Desk',
      clearedOnLabel: '11 Nov 2026',
      qrDataUri: 'data:image/png;base64,aaa',
    };
    const cleared = renderClearanceCardsHtml({
      layout: 'single',
      autoPrint: false,
      cards: [base],
    });
    expect(cleared).toContain('LIBRARY CLEARANCE: CLEARED');
    expect(cleared).toContain('returned all borrowed library books');
    expect(cleared).toContain('LCC/2026-27/03458');
    expect(cleared).toContain('Official');
    expect(cleared).toContain('NEHU Roll No.');
    expect(cleared).toContain('25034578');
    expect(cleared).not.toContain('Reg. No.');

    const pending = renderClearanceCardsHtml({
      layout: 'pair',
      autoPrint: true,
      cards: [
        {
          ...base,
          status: 'PENDING',
          booksReturned: 'NO',
          remarks: 'One book is out.',
        },
      ],
    });
    expect(pending).toContain('LIBRARY CLEARANCE: PENDING');
    expect(pending).not.toContain('returned all borrowed library books');
    expect(pending).toContain('One book is out.');
    expect(pending).toContain('window.print');
  });
});
