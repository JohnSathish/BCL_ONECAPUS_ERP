export type SchoolAddressForm = {
  line: string;
  city: string;
  state: string;
  district: string;
  pin: string;
};

export type GuardianForm = {
  id?: string;
  fullName: string;
  occupation: string;
  phone: string;
  email: string;
  photoUrl: string;
  relationship: string;
  address: SchoolAddressForm;
};

export type SiblingForm = {
  siblingStudentId: string;
  fullName: string;
  admissionNumber: string;
  rollNumber: string;
  classLabel: string;
  relationship: string;
};

export type StudentMasterFormState = {
  photoUrl: string;
  fullName: string;
  dateOfBirth: string;
  gender: string;
  bloodGroup: string;
  house: string;
  religion: string;
  casteCategory: string;
  nationality: string;
  motherTongue: string;
  languagesKnown: string[];
  aadhaarNumber: string;
  email: string;
  phone: string;
  academicYearId: string;
  admissionNumber: string;
  admissionDate: string;
  rollNumber: string;
  gradeId: string;
  sectionId: string;
  status: string;
  enrollmentLocked: boolean;
  hasSiblings: boolean;
  siblings: SiblingForm[];
  currentAddress: SchoolAddressForm;
  permanentAddress: SchoolAddressForm;
  permanentSameAsCurrent: boolean;
  usesTransport: boolean;
  transport: { routeId: string; vehicleId: string; pickupPoint: string; dropPoint: string };
  usesHostel: boolean;
  hostel: { hostelId: string; roomNumber: string; joinedAt: string };
  father: GuardianForm;
  mother: GuardianForm;
  guardian: GuardianForm;
  guardianType: 'FATHER' | 'MOTHER' | 'GUARDIAN' | 'OTHER';
  guardianSameAsFather: boolean;
  medicalHealth: string;
  allergies: string[];
  medicalConditions: string;
  medications: string;
  emergencyNotes: string;
  noPreviousSchool: boolean;
  previousSchool: {
    schoolName: string;
    address: string;
    lastClass: string;
    yearOfLeaving: string;
    tcNumber: string;
    tcDate: string;
  };
  bankName: string;
  bankBranch: string;
  bankIfsc: string;
  remarks: string;
};

export const emptyAddress = (): SchoolAddressForm => ({
  line: '',
  city: 'Tura',
  state: 'Meghalaya',
  district: 'West Garo Hills',
  pin: '794101',
});

export const emptyGuardian = (relationship = 'GUARDIAN'): GuardianForm => ({
  fullName: '',
  occupation: '',
  phone: '',
  email: '',
  photoUrl: '',
  relationship,
  address: {
    line: '',
    city: 'Tura',
    state: 'Meghalaya',
    district: 'West Garo Hills',
    pin: '794101',
  },
});

export function blankStudentMaster(academicYearId = ''): StudentMasterFormState {
  return {
    photoUrl: '',
    fullName: '',
    dateOfBirth: '',
    gender: '',
    bloodGroup: '',
    house: '',
    religion: '',
    casteCategory: '',
    nationality: 'Indian',
    motherTongue: '',
    languagesKnown: [],
    aadhaarNumber: '',
    email: '',
    phone: '',
    academicYearId,
    admissionNumber: '',
    admissionDate: new Date().toISOString().slice(0, 10),
    rollNumber: '',
    gradeId: '',
    sectionId: '',
    status: 'ACTIVE',
    enrollmentLocked: false,
    hasSiblings: false,
    siblings: [],
    currentAddress: emptyAddress(),
    permanentAddress: emptyAddress(),
    permanentSameAsCurrent: true,
    usesTransport: false,
    transport: { routeId: '', vehicleId: '', pickupPoint: '', dropPoint: '' },
    usesHostel: false,
    hostel: { hostelId: '', roomNumber: '', joinedAt: '' },
    father: emptyGuardian('FATHER'),
    mother: emptyGuardian('MOTHER'),
    guardian: emptyGuardian('GUARDIAN'),
    guardianType: 'FATHER',
    guardianSameAsFather: true,
    medicalHealth: 'GOOD',
    allergies: [],
    medicalConditions: '',
    medications: '',
    emergencyNotes: '',
    noPreviousSchool: true,
    previousSchool: {
      schoolName: '',
      address: '',
      lastClass: '',
      yearOfLeaving: '',
      tcNumber: '',
      tcDate: '',
    },
    bankName: '',
    bankBranch: '',
    bankIfsc: '',
    remarks: '',
  };
}

export const DOCUMENT_SLOTS = [
  { id: 'BIRTH_CERTIFICATE', label: 'Birth Certificate' },
  { id: 'TRANSFER_CERTIFICATE', label: 'Transfer Certificate' },
  { id: 'CASTE_CERTIFICATE', label: 'Caste Certificate' },
  { id: 'MEDICAL_CERTIFICATE', label: 'Medical Certificate' },
  { id: 'AADHAAR', label: 'Aadhaar / ID document' },
  { id: 'PREVIOUS_SCHOOL_CERTIFICATE', label: 'Previous School Certificate' },
  { id: 'OTHER', label: 'Other Documents' },
] as const;

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
export const STUDENT_STATUSES = [
  'ACTIVE',
  'INACTIVE',
  'WITHDRAWN',
  'TRANSFERRED',
  'GRADUATED',
  'SUSPENDED',
];
