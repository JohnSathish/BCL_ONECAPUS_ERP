describe('WebsiteAcademicService public staff mapping rules', () => {
  it('never exposes sensitive HR fields in the public staff shape', () => {
    const publicKeys = [
      'id',
      'name',
      'photoUrl',
      'designation',
      'qualification',
      'specialization',
      'experienceYears',
      'email',
      'phone',
      'officeLocation',
      'googleScholarUrl',
      'orcidUrl',
      'researchAreas',
      'websiteSlug',
    ];

    const forbidden = [
      'aadhaarNo',
      'panNo',
      'bankName',
      'accountNumber',
      'ifsc',
      'basicPay',
      'salaryStructure',
      'biometricId',
      'dateOfBirth',
      'mobile',
    ];

    for (const key of forbidden) {
      expect(publicKeys).not.toContain(key);
    }
  });
});
