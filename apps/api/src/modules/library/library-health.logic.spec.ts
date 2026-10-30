import { libraryHealth } from './library-health.logic';

describe('libraryHealth', () => {
  it('scores a complete collection with no loans and no digital resources without inventing those scores', () => {
    const health = libraryHealth({
      eligibleCopies: 1000,
      completeCopies: 620,
      periodEvents: 0,
      periodLabel: 'today',
      publishedDigitalAssets: 0,
      digitalViews: 0,
      activeLoans: 0,
      overdueLoans: 0,
      activeMembers: 0,
      knownMembers: 20,
    });

    expect(
      health.components.find((item) => item.key === 'coverage')?.score,
    ).toBe(62);
    expect(
      health.components.find((item) => item.key === 'circulation')?.score,
    ).toBe(0);
    expect(
      health.components.find((item) => item.key === 'digital')?.score,
    ).toBeNull();
    expect(
      health.components.find((item) => item.key === 'overdueControl')?.score,
    ).toBeNull();
    expect(
      health.components.find((item) => item.key === 'engagement')?.score,
    ).toBe(0);
    expect(health.overall).toBe(24);
  });

  it('lowers overdue control when every active loan is overdue', () => {
    const health = libraryHealth({
      eligibleCopies: 100,
      completeCopies: 100,
      periodEvents: 2,
      periodLabel: 'today',
      publishedDigitalAssets: 10,
      digitalViews: 5,
      activeLoans: 4,
      overdueLoans: 4,
      activeMembers: 5,
      knownMembers: 10,
    });

    expect(
      health.components.find((item) => item.key === 'overdueControl')?.score,
    ).toBe(0);
    expect(
      health.components.find((item) => item.key === 'digital')?.score,
    ).toBe(50);
    expect(
      health.components.find((item) => item.key === 'engagement')?.score,
    ).toBe(50);
  });

  it('returns no overall score when the library has no copies and no digital resources', () => {
    const health = libraryHealth({
      eligibleCopies: 0,
      completeCopies: 0,
      periodEvents: 0,
      periodLabel: 'today',
      publishedDigitalAssets: 0,
      digitalViews: 0,
      activeLoans: 0,
      overdueLoans: 0,
      activeMembers: 0,
      knownMembers: 0,
    });

    expect(health.overall).toBeNull();
    expect(health.components.every((item) => item.score === null)).toBe(true);
  });
});
