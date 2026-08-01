/**
 * ID Card Layout v1
 * ----------------
 * Stored as IdCardTemplate.layout (JSON). Coordinates are mm on a CR80 face.
 *
 * Element types:
 * - field  — dynamic data via fieldKey (DB/registry mapping). `label` is display-only.
 * - text   — static copy in `content`
 * - shape  — rectangle | circle | line | divider via shapeKind
 *
 * Optional `binding` (prefix/suffix/transform/showLabel) applies to field/text display
 * without changing fieldKey. Unknown keys must be ignored for forward compatibility.
 */

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

export type IdCardTextTransform = 'none' | 'uppercase' | 'lowercase' | 'titlecase';
export type IdCardShapeKind = 'rectangle' | 'circle' | 'line' | 'divider';
export type IdCardPhotoShape = 'square' | 'circle' | 'rounded';
export type IdCardShadow = 'none' | 'sm' | 'md';
export type IdCardObjectFit = 'contain' | 'cover' | 'stretch';

export type IdCardElementBinding = {
  prefix?: string;
  suffix?: string;
  textTransform?: IdCardTextTransform;
  /** When true, show display label above the value */
  showLabel?: boolean;
  characterLimit?: number;
};

export type IdCardElementStyle = {
  /** Font size in pt (designer + print). On dynamic fields, scales Pursuit type; not applied as wrapper CSS. */
  fontSize?: number;
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold' | 'extrabold';
  align?: 'left' | 'center' | 'right';
  visible?: boolean;
  photoShape?: IdCardPhotoShape;
  color?: string;
  backgroundColor?: string;
  opacity?: number;
  borderColor?: string;
  borderWidthMm?: number;
  fontFamily?: string;
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline';
  /** Letter spacing in px */
  letterSpacing?: number;
  lineHeight?: number;
  paddingMm?: number;
  borderRadiusMm?: number;
  shadow?: IdCardShadow;
  rotationDeg?: number;
  objectFit?: IdCardObjectFit;
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
  /** Bump when library seed should refresh tenant copies of this layout. */
  layoutRevision?: number;
  /** Set on designer save — blocks silent library element replace / API seed overwrite. */
  customized?: boolean;
  /** blank = built-in designer; background-upload = Photoshop/Canva workflow */
  creationMethod?: 'blank' | 'background-upload';
  /** Reserved for future PSD import pipeline */
  psdImport?: {
    pending?: boolean;
    sourceFileName?: string;
    importedAt?: string;
  };
  /** Reserved for Phase C multi-size canvas (CR80 / A4 / custom). */
  canvasPreset?: 'cr80' | 'a4-portrait' | 'a4-landscape' | 'custom';
};

export type IdCardElement = {
  id: string;
  type: 'field' | 'shape' | 'text';
  /** Registry / DB field key — never rename when changing display label */
  fieldKey?: string;
  /** Editable display label (e.g. "Class & Section"); does not change fieldKey */
  label?: string;
  /** Static text body when type === 'text' */
  content?: string;
  shapeKind?: IdCardShapeKind;
  binding?: IdCardElementBinding;
  /** Persist lock on the element (designer also tracks session locks) */
  locked?: boolean;
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
  | 'dateOfBirth';

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
  'rollNumber',
  'department',
  'programme',
  'semester',
  'academicYear',
  'dateOfBirth',
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
