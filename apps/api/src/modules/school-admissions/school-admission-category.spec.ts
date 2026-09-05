import {
  applySchoolCasteCategoryToChild,
  isSchoolCasteCategoryCode,
  resolveSchoolCasteCategory,
} from './school-admission-category';
import { requiredSchoolDocumentCodes } from './school-admission.constants';
import {
  isLegacySchoolDocumentRequirements,
  normalizeSchoolDocumentRequirements,
  resolveApplicableSchoolCertificates,
} from './school-document-requirements';

describe('school caste / category policy', () => {
  it('accepts only predefined category codes', () => {
    expect(isSchoolCasteCategoryCode('ST')).toBe(true);
    expect(isSchoolCasteCategoryCode('Garo')).toBe(false);
    expect(isSchoolCasteCategoryCode('GENERAL_UR')).toBe(true);
  });

  it('maps legacy ST text onto the ST dropdown code', () => {
    expect(resolveSchoolCasteCategory({ caste: 'ST' })?.code).toBe('ST');
    expect(
      resolveSchoolCasteCategory({ category: 'Scheduled Tribe (ST)' })?.code,
    ).toBe('ST');
  });

  it('normalizes a valid code onto both category and display label', () => {
    expect(applySchoolCasteCategoryToChild({ category: 'OBC' })).toEqual({
      category: 'OBC',
      caste: 'Other Backward Class (OBC)',
    });
  });

  it('rejects typed category values that are not in the dropdown', () => {
    expect(() => applySchoolCasteCategoryToChild({ category: 'Garo' })).toThrow(
      'INVALID_SCHOOL_CASTE_CATEGORY',
    );
  });

  it('requires Caste Certificate for General / UR so the school can verify category', () => {
    const applicable = resolveApplicableSchoolCertificates({
      child: { category: 'GENERAL_UR' },
    });
    expect(applicable.map((item) => item.slotCode)).toEqual(['CASTE_CERT']);
    expect(applicable[0]?.label).toBe('Caste Certificate');
    const codes = requiredSchoolDocumentCodes({
      child: { category: 'GENERAL_UR' },
    });
    expect(codes).toContain('CASTE_CERT');
    expect(codes).not.toContain('MOTHER_ST_CERT');
    expect(codes).not.toContain('FATHER_SC_OBC_CERT');
  });

  it('requires Mother’s ST Certificate only for ST + Garo / Khasi / Jaintia', () => {
    for (const community of ['Garo', 'Khasi', 'Jaintia', 'garo']) {
      const applicable = resolveApplicableSchoolCertificates({
        child: { category: 'ST', community },
      });
      expect(applicable.map((item) => item.slotCode)).toEqual([
        'MOTHER_ST_CERT',
      ]);
      expect(
        requiredSchoolDocumentCodes({
          child: { category: 'ST', community },
        }),
      ).toContain('MOTHER_ST_CERT');
      expect(
        requiredSchoolDocumentCodes({
          child: { category: 'ST', community },
        }),
      ).not.toContain('FATHER_SC_OBC_CERT');
    }
  });

  it('does not require Mother ST for OBC even with Khasi community', () => {
    const applicable = resolveApplicableSchoolCertificates({
      child: { category: 'OBC', community: 'Khasi' },
    });
    expect(applicable.map((item) => item.slotCode)).toEqual([
      'FATHER_SC_OBC_CERT',
    ]);
    expect(applicable[0]?.label).toBe('Father’s OBC Certificate');
  });

  it('requires Father’s SC Certificate for SC only', () => {
    const applicable = resolveApplicableSchoolCertificates({
      child: { category: 'SC' },
    });
    expect(applicable.map((item) => item.slotCode)).toEqual([
      'FATHER_SC_OBC_CERT',
    ]);
    expect(applicable[0]?.label).toBe('Father’s SC Certificate');
    expect(
      requiredSchoolDocumentCodes({ child: { category: 'SC' } }),
    ).toContain('FATHER_SC_OBC_CERT');
  });

  it('requires Father’s OBC Certificate for OBC only', () => {
    expect(
      requiredSchoolDocumentCodes({ child: { category: 'OBC' } }),
    ).toContain('FATHER_SC_OBC_CERT');
    expect(
      requiredSchoolDocumentCodes({
        child: { category: 'ST', community: 'Other' },
      }),
    ).not.toContain('FATHER_SC_OBC_CERT');
  });

  it('does not require caste certificates for ST with a non-tribe community', () => {
    const codes = requiredSchoolDocumentCodes({
      child: { category: 'ST', community: 'Other' },
    });
    expect(codes).not.toContain('MOTHER_ST_CERT');
    expect(codes).not.toContain('FATHER_SC_OBC_CERT');
  });

  it('upgrades legacy stored document requirements to the school-correct defaults', () => {
    const upgraded = normalizeSchoolDocumentRequirements({
      rules: [
        {
          id: 'mother_st_for_tribes',
          slotCode: 'MOTHER_ST_CERT',
          label: 'Mother’s ST Certificate',
          helperText: 'Required for Garo, Khasi and Jaintia candidates.',
          communities: ['Garo', 'Khasi', 'Jaintia'],
          required: true,
        },
        {
          id: 'father_sc_obc_for_st_obc',
          slotCode: 'FATHER_SC_OBC_CERT',
          label: 'Father’s SC/OBC Certificate',
          helperText: 'Required for ST/OBC candidates.',
          categories: ['ST', 'OBC'],
          required: true,
        },
      ],
    });
    expect(isLegacySchoolDocumentRequirements(upgraded.rules)).toBe(false);
    expect(upgraded.rules.map((r) => r.id)).toEqual([
      'caste_cert_for_general',
      'mother_st_for_st_tribes',
      'father_sc_for_sc',
      'father_obc_for_obc',
    ]);
  });

  it('upgrades the three-rule set that omitted General / UR caste verification', () => {
    const upgraded = normalizeSchoolDocumentRequirements({
      rules: [
        {
          id: 'mother_st_for_st_tribes',
          slotCode: 'MOTHER_ST_CERT',
          label: 'Mother’s ST Certificate',
          helperText: 'Required for Garo, Khasi and Jaintia candidates.',
          categories: ['ST'],
          communities: ['Garo', 'Khasi', 'Jaintia'],
          required: true,
        },
        {
          id: 'father_sc_for_sc',
          slotCode: 'FATHER_SC_OBC_CERT',
          label: 'Father’s SC Certificate',
          helperText: 'Required for SC candidates.',
          categories: ['SC'],
          required: true,
        },
        {
          id: 'father_obc_for_obc',
          slotCode: 'FATHER_SC_OBC_CERT',
          label: 'Father’s OBC Certificate',
          helperText: 'Required for OBC candidates.',
          categories: ['OBC'],
          required: true,
        },
      ],
    });
    expect(upgraded.rules.map((r) => r.id)).toContain('caste_cert_for_general');
  });

  it('requires father and mother income certificates', () => {
    const codes = requiredSchoolDocumentCodes(
      { child: { category: 'ST', community: 'Garo' } },
      false,
    );
    expect(codes).toContain('FATHER_INCOME');
    expect(codes).toContain('MOTHER_INCOME');
  });

  it('requires community/tribe for ST applicants', () => {
    expect(
      resolveSchoolCasteCategory({ category: 'ST' })?.requireCommunity,
    ).toBe(true);
  });
});
