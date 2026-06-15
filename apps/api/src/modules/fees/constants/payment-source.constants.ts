export const FEE_PAYMENT_SOURCES = [
  'ERP_GATEWAY',
  'SBI_ICOLLECT',
  'BANK_TRANSFER',
  'COLLEGE_QR',
  'OFFICE_QR',
  'SCHOLARSHIP',
  'ADJUSTMENT',
] as const;

export type FeePaymentSource = (typeof FEE_PAYMENT_SOURCES)[number];

export const FEE_PAYMENT_SOURCE_LABELS: Record<FeePaymentSource, string> = {
  ERP_GATEWAY: 'ERP Payment Gateway',
  SBI_ICOLLECT: 'SBI iCollect',
  BANK_TRANSFER: 'Bank Transfer',
  COLLEGE_QR: 'College Static QR',
  OFFICE_QR: 'Office QR Payment',
  SCHOLARSHIP: 'Scholarship',
  ADJUSTMENT: 'Adjustment',
};

/** Sources recorded via external payment entry (not auto gateway). */
export const EXTERNAL_FEE_PAYMENT_SOURCES: FeePaymentSource[] = [
  'SBI_ICOLLECT',
  'BANK_TRANSFER',
  'COLLEGE_QR',
  'SCHOLARSHIP',
  'ADJUSTMENT',
];

export function paymentModeForSource(source: FeePaymentSource) {
  if (source === 'ERP_GATEWAY') return 'ONLINE';
  if (source === 'OFFICE_QR') return 'OFFICE_QR';
  if (source === 'SCHOLARSHIP' || source === 'ADJUSTMENT') return 'ADJUSTMENT';
  return 'EXTERNAL';
}

export function isExternalPaymentSource(source: string) {
  return EXTERNAL_FEE_PAYMENT_SOURCES.includes(source as FeePaymentSource);
}
