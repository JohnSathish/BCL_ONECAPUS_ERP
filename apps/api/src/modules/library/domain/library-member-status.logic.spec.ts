import {
  programmeKind,
  shownStatus,
  staffActivityStatus,
  staffKind,
  studentActivityStatus,
  textMatchesResearch,
} from './library-member-status.logic';

describe('library member status', () => {
  it('treats doctoral programmes as research scholars', () => {
    expect(programmeKind('Ph.D', 'Doctor of Philosophy', 'PHD')).toBe(
      'RESEARCH_SCHOLAR',
    );
    expect(programmeKind('UG', 'B.A. History', 'BA-HIS')).toBe('STUDENT');
    expect(textMatchesResearch('Research Scholar')).toBe(true);
  });

  it('splits teaching staff from other staff', () => {
    expect(staffKind('TEACHING', 'Assistant Professor')).toBe('FACULTY');
    expect(staffKind('NON_TEACHING', 'Library Assistant')).toBe('STAFF');
    expect(staffKind('TEACHING', 'Research Scholar')).toBe('RESEARCH_SCHOLAR');
  });

  it('marks graduated and relieved people inactive without forgetting a block', () => {
    expect(studentActivityStatus('STUDYING', 'ACTIVE', 'IN_PROGRESS')).toBe(
      'ACTIVE',
    );
    expect(studentActivityStatus('ALUMNI', 'GRADUATED', 'COMPLETED')).toBe(
      'INACTIVE',
    );
    expect(staffActivityStatus('ACTIVE', null)).toBe('ACTIVE');
    expect(
      staffActivityStatus('ACTIVE', '2020-01-01', new Date('2026-10-30')),
    ).toBe('INACTIVE');
    expect(shownStatus('INACTIVE', 'BLOCKED')).toBe('BLOCKED');
    expect(shownStatus('ACTIVE', 'ACTIVE')).toBe('ACTIVE');
  });
});
