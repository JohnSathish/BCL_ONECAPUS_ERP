import { DEFAULT_COPY_ISSUE } from './library-policy.types';
import { resolveCopyIssue } from './library-copy-issue.logic';

const base = {
  copyIssue: { ...DEFAULT_COPY_ISSUE },
  referenceAllow: false,
  rareAllow: true,
};

describe('resolveCopyIssue', () => {
  it('blocks a reference copy and leaves a general copy of the same title issuable', () => {
    const reference = resolveCopyIssue({
      ...base,
      copyType: 'REFERENCE',
      issueAllowed: false,
    });
    const general = resolveCopyIssue({
      ...base,
      copyType: 'GENERAL',
      issueAllowed: true,
    });
    expect(reference.allowed).toBe(false);
    expect(reference.message).toBe(
      'This is a Reference Book. Issue is not permitted.',
    );
    expect(general.allowed).toBe(true);
    expect(general.message).toBeNull();
  });

  it('uses the saved permission instead of the copy type default', () => {
    const allowedReference = resolveCopyIssue({
      ...base,
      copyType: 'REFERENCE',
      issueAllowed: true,
    });
    const blockedGeneral = resolveCopyIssue({
      ...base,
      copyType: 'GENERAL',
      issueAllowed: false,
    });
    expect(allowedReference.allowed).toBe(true);
    expect(blockedGeneral.message).toBe(
      'Issue is not permitted for this copy.',
    );
  });

  it('applies configured defaults when a new copy has a type but no saved flag', () => {
    const rare = resolveCopyIssue({
      ...base,
      copyType: 'RARE',
      issueAllowed: null,
    });
    const reserve = resolveCopyIssue({
      ...base,
      copyType: 'RESERVE',
      issueAllowed: null,
      copyIssue: { ...DEFAULT_COPY_ISSUE, RESERVE: false },
    });
    expect(rare.allowed).toBe(false);
    expect(rare.message).toBe('This is a Rare Book. Issue is not permitted.');
    expect(reserve.allowed).toBe(false);
  });

  it('keeps the category rule for copies that have no copy type', () => {
    const legacy = resolveCopyIssue({
      ...base,
      copyType: null,
      issueAllowed: null,
      categoryCode: 'REFERENCE',
    });
    const open = resolveCopyIssue({
      ...base,
      copyType: null,
      issueAllowed: null,
      categoryCode: 'GENERAL',
    });
    expect(legacy.allowed).toBe(false);
    expect(open.allowed).toBe(true);
  });
});
