export const SCHOOL_SIS_PRODUCT = 'SECONDARY_SIS';
export const SCHOOL_SIS_PERMISSION_READ = 'school-sis:read';
export const SCHOOL_SIS_PERMISSION_MANAGE = 'school-sis:manage';
export const SCHOOL_WHATSAPP_PERMISSION_VIEW = 'whatsapp.view';
export const SCHOOL_WHATSAPP_PERMISSION_SEND = 'whatsapp.send';
export const SCHOOL_WHATSAPP_PERMISSION_MANAGE = 'whatsapp.manage';
export const SCHOOL_WHATSAPP_PERMISSION_CAMPAIGNS = 'whatsapp.campaigns';
export const SCHOOL_WHATSAPP_PERMISSION_SETTINGS = 'whatsapp.settings';
export const SCHOOL_PUSH_PERMISSION_VIEW = 'notifications.view';
export const SCHOOL_PUSH_PERMISSION_SEND = 'notifications.send';
export const SCHOOL_PUSH_PERMISSION_SCHEDULE = 'notifications.schedule';
export const SCHOOL_PUSH_PERMISSION_MANAGE = 'notifications.manage';
export const SCHOOL_AUTOMATION_PERMISSION_VIEW = 'automation.view';
export const SCHOOL_AUTOMATION_PERMISSION_CREATE = 'automation.create';
export const SCHOOL_AUTOMATION_PERMISSION_EXECUTE = 'automation.execute';
export const SCHOOL_AUTOMATION_PERMISSION_MANAGE = 'automation.manage';
export const SCHOOL_SIS_STATIONERY_UNITS = [
  'PIECE',
  'BOX',
  'PACKET',
  'SET',
  'PAIR',
  'DOZEN',
  'REAM',
  'BUNDLE',
  'KG',
  'GRAM',
  'METRE',
] as const;
export const SCHOOL_SIS_STATIONERY_PAY_METHODS = [
  'CASH',
  'UPI',
  'CARD',
  'BANK_TRANSFER',
  'ONLINE',
  'CREDIT',
  'CHEQUE',
  'OTHER',
] as const;
export const SCHOOL_ADMISSION_NUMBER_PREFIX = 'SLS';
/** Rejected on login and password set. Never assign as a shared credential. */
export const SCHOOL_FORBIDDEN_PASSWORDS = [
  'StLuke@2026',
  'StLuke@123',
  'password',
  'Password1',
  '12345678',
] as const;
export const SCHOOL_PORTAL_DEFAULT_PASSWORD = SCHOOL_FORBIDDEN_PASSWORDS[0];
export const SCHOOL_APPLICATION_NUMBER_PREFIX = 'APP';
