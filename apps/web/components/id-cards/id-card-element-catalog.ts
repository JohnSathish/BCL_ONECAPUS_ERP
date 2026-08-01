import type { IdCardElement, IdCardFieldKey, IdCardShapeKind } from '@/types/id-card-template';
import { STAFF_FIELD_KEYS, STUDENT_FIELD_KEYS } from '@/types/id-card-template';

export type IdCardCatalogCategoryId =
  | 'text'
  | 'shapes'
  | 'images'
  | 'student'
  | 'academic'
  | 'contact'
  | 'parent'
  | 'institution'
  | 'staff'
  | 'system';

export type IdCardCatalogItemKind = 'field' | 'text' | 'shape';

export type IdCardCatalogItem = {
  id: string;
  kind: IdCardCatalogItemKind;
  category: IdCardCatalogCategoryId;
  /** Default display name in the elements panel */
  defaultLabel: string;
  fieldKey?: IdCardFieldKey;
  shapeKind?: IdCardShapeKind;
  /** Hide from palette until data model exists */
  comingSoon?: boolean;
  /** student | staff | both */
  holders?: 'STUDENT' | 'STAFF' | 'BOTH';
};

export const CATALOG_CATEGORY_ORDER: { id: IdCardCatalogCategoryId; label: string }[] = [
  { id: 'text', label: 'Text' },
  { id: 'shapes', label: 'Shapes' },
  { id: 'images', label: 'Images' },
  { id: 'student', label: 'Student' },
  { id: 'academic', label: 'Academic' },
  { id: 'contact', label: 'Contact' },
  { id: 'parent', label: 'Parent' },
  { id: 'institution', label: 'Institution' },
  { id: 'staff', label: 'Staff' },
  { id: 'system', label: 'System' },
];

/** Default display labels — editable per-element via `element.label` without changing fieldKey. */
export const FIELD_DEFAULT_LABELS: Record<string, string> = {
  headerBand: 'Header Band',
  watermark: 'Watermark',
  logo: 'College Logo',
  collegeName: 'College Name',
  collegeAddress: 'College Address',
  affiliationLine: 'Affiliation',
  accreditationLine: 'Accreditation',
  photo: 'Student / Staff Photo',
  name: 'Full Name',
  roleLabel: 'Role Label',
  subtitle: 'Department Subtitle',
  registrationNumber: 'Registration Number',
  rollNumber: 'Roll Number',
  department: 'Department',
  programme: 'Programme',
  semester: 'Semester',
  academicYear: 'Academic Year',
  gender: 'Gender',
  fatherName: 'Father Name',
  motherName: 'Mother Name',
  holderAddress: 'Address',
  bloodGroup: 'Blood Group',
  qr: 'QR Code',
  barcode: 'Barcode',
  validity: 'Validity',
  validityBlock: 'Validity Block',
  emergencyContact: 'Emergency Contact',
  rfidNumber: 'RFID Number',
  securityHologram: 'Security Hologram',
  memberId: 'Member ID',
  validityFooter: 'Validity Footer',
  verificationInfo: 'Verification Info',
  address: 'Institution Address',
  terms: 'Terms',
  principalSignature: 'Principal Signature',
  footerBand: 'Footer Band',
  contact: 'Contact Block',
  email: 'Official Email',
  phone: 'Phone',
  joiningDate: 'Joining Date',
  employeeId: 'Employee ID',
  designation: 'Designation',
};

const FIELD_CATEGORY: Partial<Record<IdCardFieldKey, IdCardCatalogCategoryId>> = {
  name: 'student',
  rollNumber: 'student',
  registrationNumber: 'student',
  gender: 'student',
  bloodGroup: 'student',
  photo: 'images',
  logo: 'images',
  watermark: 'images',
  principalSignature: 'images',
  qr: 'images',
  barcode: 'images',
  rfidNumber: 'system',
  securityHologram: 'system',
  department: 'academic',
  programme: 'academic',
  semester: 'academic',
  academicYear: 'academic',
  subtitle: 'academic',
  roleLabel: 'academic',
  fatherName: 'parent',
  motherName: 'parent',
  emergencyContact: 'parent',
  holderAddress: 'contact',
  contact: 'contact',
  email: 'contact',
  phone: 'contact',
  collegeName: 'institution',
  collegeAddress: 'institution',
  affiliationLine: 'institution',
  accreditationLine: 'institution',
  address: 'institution',
  headerBand: 'institution',
  footerBand: 'institution',
  employeeId: 'staff',
  designation: 'staff',
  joiningDate: 'staff',
  validity: 'system',
  validityBlock: 'system',
  validityFooter: 'system',
  verificationInfo: 'system',
  terms: 'system',
  memberId: 'system',
};

const STATIC_ITEMS: IdCardCatalogItem[] = [
  {
    id: 'static-text',
    kind: 'text',
    category: 'text',
    defaultLabel: 'Static Text',
    holders: 'BOTH',
  },
  {
    id: 'heading-text',
    kind: 'text',
    category: 'text',
    defaultLabel: 'Heading',
    holders: 'BOTH',
  },
  {
    id: 'shape-rectangle',
    kind: 'shape',
    category: 'shapes',
    defaultLabel: 'Rectangle',
    shapeKind: 'rectangle',
    holders: 'BOTH',
  },
  {
    id: 'shape-circle',
    kind: 'shape',
    category: 'shapes',
    defaultLabel: 'Circle',
    shapeKind: 'circle',
    holders: 'BOTH',
  },
  {
    id: 'shape-line',
    kind: 'shape',
    category: 'shapes',
    defaultLabel: 'Line',
    shapeKind: 'line',
    holders: 'BOTH',
  },
  {
    id: 'shape-divider',
    kind: 'shape',
    category: 'shapes',
    defaultLabel: 'Divider',
    shapeKind: 'divider',
    holders: 'BOTH',
  },
];

function fieldItem(
  fieldKey: IdCardFieldKey,
  holders: 'STUDENT' | 'STAFF' | 'BOTH',
): IdCardCatalogItem {
  return {
    id: `field-${fieldKey}`,
    kind: 'field',
    category: FIELD_CATEGORY[fieldKey] ?? 'system',
    defaultLabel: FIELD_DEFAULT_LABELS[fieldKey] ?? fieldKey,
    fieldKey,
    holders,
  };
}

function buildCatalog(): IdCardCatalogItem[] {
  const studentOnly = new Set(STUDENT_FIELD_KEYS.filter((k) => !STAFF_FIELD_KEYS.includes(k)));
  const staffOnly = new Set(STAFF_FIELD_KEYS.filter((k) => !STUDENT_FIELD_KEYS.includes(k)));
  const allKeys = Array.from(new Set([...STUDENT_FIELD_KEYS, ...STAFF_FIELD_KEYS]));
  const fieldItems = allKeys.map((key) => {
    if (studentOnly.has(key)) return fieldItem(key, 'STUDENT');
    if (staffOnly.has(key)) return fieldItem(key, 'STAFF');
    return fieldItem(key, 'BOTH');
  });
  return [...STATIC_ITEMS, ...fieldItems];
}

export const ID_CARD_ELEMENT_CATALOG: IdCardCatalogItem[] = buildCatalog();

export function getFieldDisplayName(
  fieldKey: string | undefined | null,
  elementLabel?: string | null,
): string {
  if (elementLabel?.trim()) return elementLabel.trim();
  if (!fieldKey) return 'Element';
  return FIELD_DEFAULT_LABELS[fieldKey] ?? fieldKey;
}

export function getElementLayerLabel(element: IdCardElement): string {
  if (element.type === 'text') {
    const preview = element.content?.trim() || element.label?.trim() || 'Static Text';
    return preview.length > 28 ? `${preview.slice(0, 28)}…` : preview;
  }
  if (element.type === 'shape') {
    const kind = element.shapeKind ?? 'rectangle';
    return kind.charAt(0).toUpperCase() + kind.slice(1);
  }
  return getFieldDisplayName(element.fieldKey, element.label);
}

export function catalogItemsForHolder(
  holderType: string | undefined | null,
  search = '',
): IdCardCatalogItem[] {
  const holder = (holderType ?? 'STUDENT').toUpperCase() === 'STAFF' ? 'STAFF' : 'STUDENT';
  const q = search.trim().toLowerCase();
  return ID_CARD_ELEMENT_CATALOG.filter((item) => {
    if (item.comingSoon) return false;
    if (item.holders === 'STUDENT' && holder !== 'STUDENT') return false;
    if (item.holders === 'STAFF' && holder !== 'STAFF') return false;
    if (!q) return true;
    return (
      item.defaultLabel.toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q) ||
      (item.fieldKey?.toLowerCase().includes(q) ?? false)
    );
  });
}

export function groupCatalogByCategory(items: IdCardCatalogItem[]) {
  return CATALOG_CATEGORY_ORDER.map((cat) => ({
    ...cat,
    items: items.filter((i) => i.category === cat.id),
  })).filter((g) => g.items.length > 0);
}

/** Drag payload for palette → canvas */
export type PaletteDragPayload =
  | { kind: 'field'; fieldKey: string }
  | { kind: 'text'; variant?: 'heading' | 'body' }
  | { kind: 'shape'; shapeKind: IdCardShapeKind };

export const PALETTE_ELEMENT_MIME = 'application/x-id-card-element';

export function serializePalettePayload(payload: PaletteDragPayload): string {
  return JSON.stringify(payload);
}

export function parsePalettePayload(raw: string): PaletteDragPayload | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as PaletteDragPayload;
    if (parsed.kind === 'field' && parsed.fieldKey) return parsed;
    if (parsed.kind === 'text') return parsed;
    if (parsed.kind === 'shape' && parsed.shapeKind) return parsed;
  } catch {
    /* legacy plain field key */
  }
  if (/^[a-zA-Z][a-zA-Z0-9]*$/.test(raw.trim())) {
    return { kind: 'field', fieldKey: raw.trim() };
  }
  return null;
}

export function defaultContentForTextVariant(variant?: 'heading' | 'body'): string {
  return variant === 'heading' ? 'Heading' : 'Static text';
}
