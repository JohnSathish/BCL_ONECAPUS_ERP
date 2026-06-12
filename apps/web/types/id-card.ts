import type { InstitutionBranding } from '@/types/branding';

/** CR80 card payload for rendering and print. */
export type StudentIdCardModel = {
  cardType: 'student';
  institution: {
    displayName: string;
    shortName: string;
    logoUrl: string | null;
    address: string | null;
    campusName: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    primaryColor: string;
    accentColor: string;
    affiliationLine?: string | null;
    accreditationLine?: string | null;
  };
  holder: {
    fullName: string;
    displayFullName?: string | null;
    photoUrl: string | null;
    roleLabel: string;
    subtitle: string;
    rollNumber: string;
    registrationNumber: string | null;
    department: string | null;
    programme: string | null;
    semester: string | null;
    shift: string | null;
    gender: string | null;
    fatherName: string | null;
    motherName: string | null;
    holderAddress: string | null;
    bloodGroup: string | null;
    rfidNumber: string | null;
    emergencyContact: string | null;
  };
  verification: {
    qrImageUrl: string | null;
    qrPayload: string | null;
    barcodeValue: string;
  };
  validity: {
    validFrom: string;
    validTo: string;
    validToLabel: string;
    validUntil?: string;
    courseCompletion?: string;
    expiryDate?: string;
  };
  branding?: InstitutionBranding | null;
};

export type StaffIdCardModel = {
  cardType: 'staff';
  institution: StudentIdCardModel['institution'];
  holder: {
    fullName: string;
    photoUrl: string | null;
    roleLabel: string;
    employeeId: string;
    designation: string | null;
    department: string | null;
    bloodGroup: string | null;
    rfidNumber: string | null;
    emergencyContact: string | null;
    email: string | null;
    phone: string | null;
    joiningDate: string | null;
  };
  verification: StudentIdCardModel['verification'];
  validity: StudentIdCardModel['validity'];
  branding?: InstitutionBranding | null;
};

export type IdCardModel = StudentIdCardModel | StaffIdCardModel;

export type IdCardPrintOptions = {
  /** Evolis Primacy: front side rotated 180° in driver */
  evolisFrontRotate180?: boolean;
  side: 'front' | 'back' | 'both';
};
