import { homeworkListStatus } from './school-sis-homework.status';

describe('homeworkListStatus', () => {
  const today = '2026-09-21';

  it('marks drafts separately from due dates', () => {
    expect(
      homeworkListStatus({
        status: 'DRAFT',
        dueDate: '2026-09-10',
        today,
      }),
    ).toBe('draft');
  });

  it('treats past due work as completed', () => {
    expect(
      homeworkListStatus({
        status: 'ASSIGNED',
        dueDate: '2026-09-15',
        today,
      }),
    ).toBe('completed');
  });

  it('flags work due within two days as pending', () => {
    expect(
      homeworkListStatus({
        status: 'ASSIGNED',
        dueDate: '2026-09-23',
        today,
      }),
    ).toBe('pending');
  });

  it('keeps later due dates active', () => {
    expect(
      homeworkListStatus({
        status: 'ASSIGNED',
        dueDate: '2026-09-28',
        today,
      }),
    ).toBe('active');
  });
});
