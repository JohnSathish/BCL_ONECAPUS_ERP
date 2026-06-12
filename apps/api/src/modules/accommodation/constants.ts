export const QUARTER_STATUSES = [
  'VACANT',
  'OCCUPIED',
  'RESERVED',
  'MAINTENANCE',
] as const;
export type QuarterStatus = (typeof QUARTER_STATUSES)[number];

export const OCCUPANCY_STATUSES = ['ACTIVE', 'COMPLETED'] as const;

export const DEFAULT_QUARTER_TYPES = [
  { slug: 'FACULTY', name: 'Faculty Quarter' },
  { slug: 'TEACHING', name: 'Teaching Staff Quarter' },
  { slug: 'NON_TEACHING', name: 'Non-Teaching Staff Quarter' },
  { slug: 'GUEST_HOUSE', name: 'Guest House' },
  { slug: 'VISITING_FACULTY', name: 'Visiting Faculty Accommodation' },
  { slug: 'WARDEN', name: 'Warden Quarter' },
  { slug: 'PRINCIPAL', name: 'Principal Residence' },
] as const;

export const CHARGE_TYPES = [
  'ELECTRICITY',
  'WATER',
  'INTERNET',
  'MAINTENANCE',
  'REPAIR',
  'OTHER',
] as const;

export const ACCOMMODATION_COMPONENT_CODES = {
  QUARTER_RENT: 'QUARTER_RENT',
  ACCOM_WATER: 'ACCOM_WATER',
  ACCOM_ELECTRICITY: 'ACCOM_ELECTRICITY',
  ACCOM_MAINTENANCE: 'ACCOM_MAINTENANCE',
  ACCOM_INTERNET: 'ACCOM_INTERNET',
} as const;

export const CHARGE_TYPE_TO_COMPONENT: Record<string, string> = {
  WATER: ACCOMMODATION_COMPONENT_CODES.ACCOM_WATER,
  ELECTRICITY: ACCOMMODATION_COMPONENT_CODES.ACCOM_ELECTRICITY,
  MAINTENANCE: ACCOMMODATION_COMPONENT_CODES.ACCOM_MAINTENANCE,
  REPAIR: ACCOMMODATION_COMPONENT_CODES.ACCOM_MAINTENANCE,
  INTERNET: ACCOMMODATION_COMPONENT_CODES.ACCOM_INTERNET,
  OTHER: ACCOMMODATION_COMPONENT_CODES.ACCOM_MAINTENANCE,
};
