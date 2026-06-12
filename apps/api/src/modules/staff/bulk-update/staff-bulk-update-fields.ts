export type StaffBulkUpdateInputType =
  | 'text'
  | 'email'
  | 'date'
  | 'select'
  | 'lookup'
  | 'boolean';

export type StaffBulkUpdateFieldDef = {
  fieldKey: string;
  sectionKey:
    | 'basic'
    | 'employment'
    | 'portal'
    | 'address'
    | 'device'
    | 'academic';
  label: string;
  group: string;
  inputType: StaffBulkUpdateInputType;
  supportsAppend: boolean;
  requiredPermission?: string;
  lookupType?: 'department' | 'designation' | 'shift' | 'role';
  aliases?: string[];
};

export const STAFF_BULK_UPDATE_FIELD_CATALOG: StaffBulkUpdateFieldDef[] = [
  {
    fieldKey: 'fullName',
    sectionKey: 'basic',
    label: 'Full Name',
    group: 'Identity',
    inputType: 'text',
    supportsAppend: false,
    aliases: ['Full Name', 'Name'],
  },
  {
    fieldKey: 'mobile',
    sectionKey: 'basic',
    label: 'Mobile Number',
    group: 'Identity',
    inputType: 'text',
    supportsAppend: false,
    aliases: ['Mobile', 'Mobile Number', 'Phone'],
  },
  {
    fieldKey: 'email',
    sectionKey: 'basic',
    label: 'Email',
    group: 'Identity',
    inputType: 'email',
    supportsAppend: false,
    aliases: ['Email', 'Email ID'],
  },
  {
    fieldKey: 'alternateEmail',
    sectionKey: 'portal',
    label: 'Alternate Email',
    group: 'Identity',
    inputType: 'email',
    supportsAppend: false,
    aliases: ['Alternate Email'],
  },
  {
    fieldKey: 'shortCode',
    sectionKey: 'basic',
    label: 'Staff Short Code',
    group: 'Identity',
    inputType: 'text',
    supportsAppend: false,
    aliases: ['Short Code', 'Staff Short Code'],
  },
  {
    fieldKey: 'employeeCode',
    sectionKey: 'basic',
    label: 'Employee Code',
    group: 'Identity',
    inputType: 'text',
    supportsAppend: false,
    aliases: ['Employee Code'],
  },
  {
    fieldKey: 'dateOfBirth',
    sectionKey: 'basic',
    label: 'Date of Birth',
    group: 'Identity',
    inputType: 'date',
    supportsAppend: false,
    aliases: ['DOB', 'Date of Birth'],
  },
  {
    fieldKey: 'gender',
    sectionKey: 'basic',
    label: 'Gender',
    group: 'Identity',
    inputType: 'select',
    supportsAppend: false,
    aliases: ['Gender'],
  },
  {
    fieldKey: 'staffType',
    sectionKey: 'employment',
    label: 'Staff Type',
    group: 'Employment',
    inputType: 'select',
    supportsAppend: false,
    aliases: ['Staff Type', 'Teaching Classification'],
  },
  {
    fieldKey: 'departmentId',
    sectionKey: 'employment',
    label: 'Department',
    group: 'Employment',
    inputType: 'lookup',
    lookupType: 'department',
    supportsAppend: false,
    aliases: ['Department'],
  },
  {
    fieldKey: 'designationId',
    sectionKey: 'employment',
    label: 'Designation',
    group: 'Employment',
    inputType: 'lookup',
    lookupType: 'designation',
    supportsAppend: false,
    aliases: ['Designation'],
  },
  {
    fieldKey: 'primaryShiftId',
    sectionKey: 'employment',
    label: 'Shift',
    group: 'Employment',
    inputType: 'lookup',
    lookupType: 'shift',
    supportsAppend: false,
    aliases: ['Shift', 'Primary Shift'],
  },
  {
    fieldKey: 'joiningDate',
    sectionKey: 'employment',
    label: 'Joining Date',
    group: 'Employment',
    inputType: 'date',
    supportsAppend: false,
    aliases: ['Joining Date'],
  },
  {
    fieldKey: 'status',
    sectionKey: 'employment',
    label: 'Employment Status',
    group: 'Employment',
    inputType: 'select',
    supportsAppend: false,
    aliases: ['Status', 'Employment Status'],
  },
  {
    fieldKey: 'additionalRoleCodes',
    sectionKey: 'academic',
    label: 'Role',
    group: 'Employment',
    inputType: 'lookup',
    lookupType: 'role',
    supportsAppend: false,
    aliases: ['Role', 'Academic Role', 'HoD Assignment'],
  },
  {
    fieldKey: 'rfidNo',
    sectionKey: 'device',
    label: 'RFID Number',
    group: 'Device / Access',
    inputType: 'text',
    supportsAppend: false,
    aliases: ['RFID', 'RFID Number'],
  },
  {
    fieldKey: 'biometricId',
    sectionKey: 'device',
    label: 'Biometric ID',
    group: 'Device / Access',
    inputType: 'text',
    supportsAppend: false,
    aliases: ['Biometric ID'],
  },
  {
    fieldKey: 'portalEmail',
    sectionKey: 'portal',
    label: 'Portal Email',
    group: 'Portal Access',
    inputType: 'email',
    supportsAppend: false,
    aliases: ['Portal Email'],
  },
  {
    fieldKey: 'portalActive',
    sectionKey: 'portal',
    label: 'Portal Status',
    group: 'Portal Access',
    inputType: 'boolean',
    supportsAppend: false,
    aliases: ['Portal Status', 'Portal Active'],
  },
  {
    fieldKey: 'teachingType',
    sectionKey: 'academic',
    label: 'Teaching Type',
    group: 'Academic / Teaching',
    inputType: 'text',
    supportsAppend: false,
    aliases: ['Teaching Type'],
  },
  {
    fieldKey: 'eligibleSubjects',
    sectionKey: 'academic',
    label: 'Eligible Subjects',
    group: 'Academic / Teaching',
    inputType: 'text',
    supportsAppend: true,
    aliases: ['Eligible Subjects'],
  },
  {
    fieldKey: 'researchRole',
    sectionKey: 'academic',
    label: 'Research Role',
    group: 'Academic / Teaching',
    inputType: 'text',
    supportsAppend: false,
    aliases: ['Research Role'],
  },
  {
    fieldKey: 'facultyCategory',
    sectionKey: 'academic',
    label: 'Faculty Category',
    group: 'Academic / Teaching',
    inputType: 'text',
    supportsAppend: false,
    aliases: ['Faculty Category'],
  },
  {
    fieldKey: 'address',
    sectionKey: 'address',
    label: 'Address',
    group: 'Address',
    inputType: 'text',
    supportsAppend: true,
    aliases: ['Address'],
  },
  {
    fieldKey: 'city',
    sectionKey: 'address',
    label: 'City',
    group: 'Address',
    inputType: 'text',
    supportsAppend: false,
    aliases: ['City'],
  },
  {
    fieldKey: 'state',
    sectionKey: 'address',
    label: 'State',
    group: 'Address',
    inputType: 'text',
    supportsAppend: false,
    aliases: ['State'],
  },
  {
    fieldKey: 'postalCode',
    sectionKey: 'address',
    label: 'Postal Code',
    group: 'Address',
    inputType: 'text',
    supportsAppend: false,
    aliases: ['Postal Code', 'PIN'],
  },
];

export const STAFF_BULK_UPDATE_FIELD_MAP = new Map(
  STAFF_BULK_UPDATE_FIELD_CATALOG.map((field) => [field.fieldKey, field]),
);

export function getStaffBulkUpdateFieldsGrouped() {
  const groups = new Map<string, StaffBulkUpdateFieldDef[]>();
  for (const field of STAFF_BULK_UPDATE_FIELD_CATALOG) {
    const list = groups.get(field.group) ?? [];
    list.push(field);
    groups.set(field.group, list);
  }
  return [...groups.entries()].map(([group, fields]) => ({ group, fields }));
}

export function resolveStaffBulkFieldKey(header: string) {
  const normalized = normalizeHeader(header);
  return STAFF_BULK_UPDATE_FIELD_CATALOG.find(
    (field) =>
      normalizeHeader(field.fieldKey) === normalized ||
      normalizeHeader(field.label) === normalized ||
      (field.aliases ?? []).some(
        (alias) => normalizeHeader(alias) === normalized,
      ),
  )?.fieldKey;
}

export function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function serializeStaffBulkValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
