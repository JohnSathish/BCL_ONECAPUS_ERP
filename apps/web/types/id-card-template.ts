export type IdCardBackgroundFit = 'stretch' | 'contain' | 'cover' | 'original';

export type IdCardBackgroundLayer = {
  imageUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity?: number;
  fit?: IdCardBackgroundFit;
  locked?: boolean;
  naturalWidth?: number | null;
  naturalHeight?: number | null;
};

export type IdCardElementStyle = {
  fontSize?: number;
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold' | 'extrabold';
  align?: 'left' | 'center' | 'right';
  visible?: boolean;
  photoShape?: 'square' | 'circle';
  color?: string;
  backgroundColor?: string;
  opacity?: number;
  borderColor?: string;
  borderWidthMm?: number;
};

export type IdCardLayoutMeta = {
  libraryCode?: string;
  stylePreset?:
    | 'classic'
    | 'gradient'
    | 'corporate'
    | 'academic'
    | 'rfid'
    | 'minimal'
    | 'gold'
    | 'compact'
    | 'geometric'
    | 'elite'
    | 'pursuit-excellence'
    | 'pursuit-staff';
  /** blank = built-in designer; background-upload = Photoshop/Canva workflow */
  creationMethod?: 'blank' | 'background-upload';
  /** Reserved for future PSD import pipeline */
  psdImport?: {
    pending?: boolean;
    sourceFileName?: string;
    importedAt?: string;
  };
};

export type IdCardElement = {
  id: string;
  type: 'field' | 'shape' | 'text';
  fieldKey?: string;
  label?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex?: number;
  style?: IdCardElementStyle;
};

export type IdCardLayoutV1 = {
  version: 1;
  meta?: IdCardLayoutMeta;
  /** Layer 0 — bottom-most printable background for the front face */
  frontBackground?: IdCardBackgroundLayer | null;
  /** Layer 0 — bottom-most printable background for the back face */
  backBackground?: IdCardBackgroundLayer | null;
  front: IdCardElement[];
  back: IdCardElement[];
};

export type IdCardLegacyLayout = {
  front?: string[];
  back?: string[];
};

export type IdCardLayoutInput = IdCardLayoutV1 | IdCardLegacyLayout | Record<string, unknown>;

export type IdCardFieldKey =
  | 'logo'
  | 'photo'
  | 'name'
  | 'registrationNumber'
  | 'rollNumber'
  | 'programme'
  | 'department'
  | 'semester'
  | 'academicYear'
  | 'gender'
  | 'fatherName'
  | 'motherName'
  | 'holderAddress'
  | 'collegeName'
  | 'collegeAddress'
  | 'affiliationLine'
  | 'accreditationLine'
  | 'watermark'
  | 'validityBlock'
  | 'verificationInfo'
  | 'employeeId'
  | 'designation'
  | 'bloodGroup'
  | 'roleLabel'
  | 'subtitle'
  | 'qr'
  | 'barcode'
  | 'validity'
  | 'validityFooter'
  | 'address'
  | 'contact'
  | 'emergencyContact'
  | 'terms'
  | 'principalSignature'
  | 'headerBand'
  | 'footerBand'
  | 'memberId'
  | 'rfidNumber'
  | 'securityHologram'
  | 'email'
  | 'phone'
  | 'joiningDate'
  | 'contact';

export const STUDENT_FIELD_KEYS: IdCardFieldKey[] = [
  'headerBand',
  'watermark',
  'logo',
  'collegeName',
  'collegeAddress',
  'affiliationLine',
  'accreditationLine',
  'photo',
  'name',
  'roleLabel',
  'subtitle',
  'registrationNumber',
  'department',
  'programme',
  'gender',
  'bloodGroup',
  'validityBlock',
  'qr',
  'barcode',
  'holderAddress',
  'fatherName',
  'motherName',
  'emergencyContact',
  'verificationInfo',
  'address',
  'terms',
  'validityFooter',
  'principalSignature',
  'footerBand',
  'contact',
  'rfidNumber',
  'securityHologram',
  'validity',
];

export const STAFF_FIELD_KEYS: IdCardFieldKey[] = [
  'headerBand',
  'footerBand',
  'watermark',
  'logo',
  'collegeName',
  'collegeAddress',
  'affiliationLine',
  'accreditationLine',
  'photo',
  'name',
  'subtitle',
  'roleLabel',
  'employeeId',
  'designation',
  'department',
  'email',
  'phone',
  'joiningDate',
  'rfidNumber',
  'validity',
  'principalSignature',
  'bloodGroup',
  'qr',
  'barcode',
  'verificationInfo',
  'contact',
  'address',
  'emergencyContact',
  'terms',
  'validityFooter',
];
