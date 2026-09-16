export const SIS_SMS_VIEW = [
  'school-sis:manage',
  'sms.view',
  'sms.send',
] as const;
export const SIS_SMS_SEND = [
  'school-sis:manage',
  'sms.send',
  'sms.send_bulk',
] as const;
export const SIS_SMS_BULK = [
  'school-sis:manage',
  'sms.send_bulk',
  'sms.campaigns',
] as const;
export const SIS_SMS_TEMPLATES = [
  'school-sis:manage',
  'sms.templates.view',
  'sms.templates.create',
  'sms.templates.edit',
] as const;
export const SIS_SMS_GATEWAY = [
  'school-sis:manage',
  'sms.gateway.view',
  'sms.gateway.manage',
] as const;
export const SIS_SMS_DLT = ['school-sis:manage', 'sms.dlt.manage'] as const;
export const SIS_SMS_SETTINGS = [
  'school-sis:manage',
  'sms.settings.manage',
] as const;
export const SIS_SMS_REPORTS = [
  'school-sis:manage',
  'sms.delivery_reports',
  'sms.export',
] as const;
