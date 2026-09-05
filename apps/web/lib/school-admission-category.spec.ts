import { describe, expect, it } from 'vitest';
import { isSchoolCasteCategoryCode, resolveSchoolCasteCategory } from './school-admission-category';
import { getSchoolFormGaps, schoolCertificateSlots } from './school-application-progress';
import {
  isLegacySchoolDocumentRequirements,
  normalizeSchoolDocumentRequirements,
  resolveApplicableSchoolCertificates,
} from './school-document-requirements';

describe('school caste / category (parent portal)', () => {
  it('does not accept free-typed category values', () => {
    expect(isSchoolCasteCategoryCode('Garo')).toBe(false);
    expect(isSchoolCasteCategoryCode('ST')).toBe(true);
  });

  it('shows Community / Tribe for ST and Other only', () => {
    expect(resolveSchoolCasteCategory({ category: 'ST' })?.requireCommunity).toBe(true);
    expect(resolveSchoolCasteCategory({ category: 'OTHER' })?.requireCommunity).toBe(true);
    expect(resolveSchoolCasteCategory({ category: 'GENERAL_UR' })?.requireCommunity).toBe(false);
  });

  it('requires Mother’s ST Certificate for ST + Garo/Khasi/Jaintia only', () => {
    expect(
      schoolCertificateSlots({ child: { category: 'ST', community: 'Garo' } }).find(
        (slot) => slot.code === 'MOTHER_ST_CERT',
      ),
    ).toMatchObject({
      required: true,
      label: 'Mother’s ST Certificate',
    });
    expect(
      schoolCertificateSlots({ child: { category: 'ST', community: 'Other' } }).some(
        (slot) => slot.code === 'MOTHER_ST_CERT',
      ),
    ).toBe(false);
    expect(
      schoolCertificateSlots({ child: { category: 'OBC', community: 'Khasi' } }).some(
        (slot) => slot.code === 'MOTHER_ST_CERT',
      ),
    ).toBe(false);
  });

  it('requires Father’s SC Certificate for SC only', () => {
    expect(
      schoolCertificateSlots({ child: { category: 'SC' } }).find(
        (slot) => slot.code === 'FATHER_SC_OBC_CERT',
      ),
    ).toMatchObject({
      required: true,
      label: 'Father’s SC Certificate',
    });
  });

  it('requires Father’s OBC Certificate for OBC only', () => {
    expect(
      schoolCertificateSlots({ child: { category: 'OBC' } }).find(
        (slot) => slot.code === 'FATHER_SC_OBC_CERT',
      ),
    ).toMatchObject({
      required: true,
      label: 'Father’s OBC Certificate',
    });
    expect(
      schoolCertificateSlots({ child: { category: 'GENERAL_UR' } }).some(
        (slot) => slot.code === 'FATHER_SC_OBC_CERT',
      ),
    ).toBe(false);
  });

  it('requires Caste Certificate for General / UR', () => {
    expect(
      schoolCertificateSlots({ child: { category: 'GENERAL_UR' } }).find(
        (slot) => slot.code === 'CASTE_CERT',
      ),
    ).toMatchObject({
      required: true,
      label: 'Caste Certificate',
    });
  });

  it('requires mother income certificate', () => {
    const slots = schoolCertificateSlots({ child: { category: 'GENERAL_UR' } });
    const mother = slots.find((slot) => slot.code === 'MOTHER_INCOME');
    expect(mother).toBeTruthy();
    expect(mother?.required).toBe(true);
    expect(mother?.optional).toBe(false);
    expect(slots.filter((slot) => slot.required).map((slot) => slot.code)).toEqual([
      'PHOTO',
      'BIRTH_CERT',
      'CASTE_CERT',
      'LAST_SCHOOL_REPORT',
      'LAST_SCHOOL_CERT',
      'FATHER_INCOME',
      'MOTHER_INCOME',
    ]);
  });

  it('requires Mother ST only (not Father) for Garo ST applicants', () => {
    const slots = schoolCertificateSlots({
      child: { category: 'ST', community: 'Garo' },
    });
    expect(slots.filter((slot) => slot.required).map((slot) => slot.code)).toEqual([
      'PHOTO',
      'BIRTH_CERT',
      'MOTHER_ST_CERT',
      'LAST_SCHOOL_REPORT',
      'LAST_SCHOOL_CERT',
      'FATHER_INCOME',
      'MOTHER_INCOME',
    ]);
  });

  it('keeps a previously uploaded caste certificate visible when category no longer requires it', () => {
    const slots = schoolCertificateSlots({ child: { category: 'SC' } }, ['CASTE_CERT']);
    const caste = slots.find((slot) => slot.code === 'CASTE_CERT');
    expect(caste?.required).toBe(false);
    expect(caste).toBeTruthy();
  });

  it('blocks continue when category is missing or community is required', () => {
    expect(getSchoolFormGaps({ child: { caste: 'Garo' } })).toContain('Caste / Category');
    expect(getSchoolFormGaps({ child: { category: 'ST' } })).toContain(
      'Community / Tribe (if applicable)',
    );
  });

  it('resolves applicable certificates without mixing Mother ST and Father OBC', () => {
    const applicable = resolveApplicableSchoolCertificates({
      child: { category: 'OBC', community: 'Khasi' },
    });
    expect(applicable.map((item) => item.slotCode)).toEqual(['FATHER_SC_OBC_CERT']);
  });

  it('upgrades legacy stored document requirements', () => {
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
    expect(upgraded.rules).toHaveLength(4);
    expect(upgraded.rules.map((r) => r.id)).toContain('caste_cert_for_general');
  });
});
