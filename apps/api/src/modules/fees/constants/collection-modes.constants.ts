export const COLLECTION_MODE_KEYS = [
  'gateway',
  'upi_qr',
  'sbi_icollect',
  'bank_transfer',
  'cash',
  'cheque',
  'dd',
  'scholarship',
  'fee_waiver',
] as const;

export type CollectionModeKey = (typeof COLLECTION_MODE_KEYS)[number];

export const COLLECTION_MODE_LABELS: Record<CollectionModeKey, string> = {
  gateway: 'Online Gateway',
  upi_qr: 'UPI QR',
  sbi_icollect: 'SBI iCollect',
  bank_transfer: 'Bank Transfer',
  cash: 'Cash Collection',
  cheque: 'Cheque',
  dd: 'Demand Draft (DD)',
  scholarship: 'Scholarship Adjustment',
  fee_waiver: 'Fee Waiver',
};

export type CollectionModesConfig = Record<CollectionModeKey, boolean>;

export const DEFAULT_COLLECTION_MODES: CollectionModesConfig = {
  gateway: false,
  upi_qr: true,
  sbi_icollect: true,
  bank_transfer: true,
  cash: false,
  cheque: false,
  dd: false,
  scholarship: true,
  fee_waiver: true,
};

/** Sensible out-of-box defaults for new colleges (Don Bosco-style; cash/cheque configurable per institution). */
export const INSTITUTION_FEE_DEFAULTS = {
  collectionModes: {
    gateway: true,
    upi_qr: true,
    sbi_icollect: true,
    bank_transfer: true,
    cash: true,
    cheque: true,
    dd: false,
    scholarship: true,
    fee_waiver: true,
  } satisfies CollectionModesConfig,
  onlinePaymentEnabled: true,
  cashCollectionEnabled: true,
  officeQrEnabled: true,
  monthlyDueDay: 10,
  cashReceiptPrefix: 'DBC/CASH',
  receiptPrefix: 'DBC/RCPT',
  paymentRequestExpiryMinutes: 15,
};

/** Desk / portal display order */
export const COLLECTION_MODE_ORDER: CollectionModeKey[] = [
  'gateway',
  'upi_qr',
  'sbi_icollect',
  'bank_transfer',
  'cash',
  'cheque',
  'dd',
  'scholarship',
  'fee_waiver',
];

export function resolveCollectionModes(settings: {
  collectionModes?: unknown;
  onlinePaymentEnabled?: boolean;
  cashCollectionEnabled?: boolean;
  officeQrEnabled?: boolean;
}): CollectionModesConfig {
  const stored = settings.collectionModes as
    | Partial<CollectionModesConfig>
    | null
    | undefined;
  if (stored && typeof stored === 'object' && Object.keys(stored).length > 0) {
    return { ...DEFAULT_COLLECTION_MODES, ...stored };
  }
  return {
    ...DEFAULT_COLLECTION_MODES,
    gateway: Boolean(settings.onlinePaymentEnabled),
    upi_qr: settings.officeQrEnabled !== false,
    cash: Boolean(settings.cashCollectionEnabled),
  };
}

export function enabledCollectionModes(modes: CollectionModesConfig) {
  return COLLECTION_MODE_ORDER.filter((key) => modes[key]).map((key) => ({
    key,
    label: COLLECTION_MODE_LABELS[key],
  }));
}

export function paymentModeToCollectionMode(
  paymentMode: string,
  paymentSource?: string | null,
): CollectionModeKey | null {
  const source = paymentSource?.toUpperCase();
  if (source === 'SBI_ICOLLECT') return 'sbi_icollect';
  if (source === 'BANK_TRANSFER') return 'bank_transfer';
  if (source === 'SCHOLARSHIP') return 'scholarship';
  if (source === 'ADJUSTMENT' || source === 'FEE_WAIVER') return 'fee_waiver';
  if (source === 'COLLEGE_QR') return 'upi_qr';
  if (source === 'ERP_GATEWAY' || paymentMode === 'ONLINE') return 'gateway';
  if (source === 'OFFICE_QR' || paymentMode === 'OFFICE_QR') return 'upi_qr';

  const mode = paymentMode.toUpperCase();
  if (mode === 'CASH') return 'cash';
  if (mode === 'CHEQUE') return 'cheque';
  if (mode === 'DD') return 'dd';
  if (mode === 'ONLINE') return 'gateway';
  return null;
}

export function externalSourceAllowed(
  source: string,
  modes: CollectionModesConfig,
) {
  const map: Record<string, CollectionModeKey> = {
    SBI_ICOLLECT: 'sbi_icollect',
    BANK_TRANSFER: 'bank_transfer',
    COLLEGE_QR: 'upi_qr',
    SCHOLARSHIP: 'scholarship',
    ADJUSTMENT: 'fee_waiver',
  };
  const key = map[source];
  return key ? modes[key] : true;
}

export function studentPortalPaymentHints(
  modes: CollectionModesConfig,
  metadata?: Record<string, unknown> | null,
) {
  const officeMethods: string[] = [];
  if (modes.cash) officeMethods.push('cash');
  if (modes.upi_qr) officeMethods.push('UPI QR at accounts office');
  if (modes.sbi_icollect) officeMethods.push('SBI iCollect');
  if (modes.bank_transfer) officeMethods.push('bank transfer');
  if (modes.cheque) officeMethods.push('cheque');
  if (modes.dd) officeMethods.push('demand draft');

  return {
    onlineEnabled: modes.gateway,
    officePaymentEnabled: officeMethods.length > 0,
    officeMethods,
    showPayAtOffice: officeMethods.length > 0,
    showOnlineOnlyMessage: modes.gateway && !officeMethods.length,
    allowAdvanceMonthlyPayment: Boolean(metadata?.allowAdvanceMonthlyPayment),
  };
}
