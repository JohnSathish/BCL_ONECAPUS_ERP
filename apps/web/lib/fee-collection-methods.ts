import type { CollectionModeKey } from '@/types/fee-cycle';

export type DeskPaymentMethodId =
  | 'cash'
  | 'college_qr'
  | 'sbi_icollect'
  | 'bank_transfer'
  | 'cheque'
  | 'dd'
  | 'gateway'
  | 'scholarship'
  | 'fee_waiver'
  | 'other';

export type DeskFieldType = 'text' | 'number' | 'date' | 'textarea' | 'file' | 'readonly';

export type DeskPaymentFieldDef = {
  key: string;
  label: string;
  type: DeskFieldType;
  required?: boolean;
  placeholder?: string;
  readonlyValueKey?: 'bankAccount';
};

export type DeskPaymentMethodDef = {
  id: DeskPaymentMethodId;
  label: string;
  collectionModeKey: CollectionModeKey | null;
  paymentMode: string;
  paymentSource?: string;
  fields: DeskPaymentFieldDef[];
  pendingClearance?: boolean;
  usesPaymentRequest?: boolean;
};

export type DeskPaymentFormValues = Record<string, string>;

export const DESK_PAYMENT_METHODS: DeskPaymentMethodDef[] = [
  {
    id: 'cash',
    label: 'Cash',
    collectionModeKey: 'cash',
    paymentMode: 'CASH',
    fields: [{ key: 'remarks', label: 'Remarks', type: 'textarea', placeholder: 'Optional notes' }],
  },
  {
    id: 'college_qr',
    label: 'College QR Payment',
    collectionModeKey: 'upi_qr',
    paymentMode: 'EXTERNAL',
    paymentSource: 'COLLEGE_QR',
    fields: [
      {
        key: 'transactionReference',
        label: 'Transaction Reference Number',
        type: 'text',
        required: true,
        placeholder: 'UPI / QR transaction ref',
      },
      { key: 'utrNumber', label: 'UTR Number', type: 'text', required: true, placeholder: 'UTR' },
      { key: 'screenshotUpload', label: 'Screenshot Upload (optional)', type: 'file' },
      { key: 'remarks', label: 'Remarks', type: 'textarea' },
    ],
  },
  {
    id: 'sbi_icollect',
    label: 'SBI iCollect',
    collectionModeKey: 'sbi_icollect',
    paymentMode: 'EXTERNAL',
    paymentSource: 'SBI_ICOLLECT',
    fields: [
      {
        key: 'sbiTransactionId',
        label: 'SBI Transaction ID',
        type: 'text',
        required: true,
        placeholder: 'e.g. ICL202600178',
      },
      {
        key: 'bankReferenceNumber',
        label: 'Bank Reference Number',
        type: 'text',
        required: true,
        placeholder: 'Bank reference',
      },
      { key: 'paymentDate', label: 'Payment Date', type: 'date', required: true },
      { key: 'receiptUpload', label: 'Receipt Upload (optional)', type: 'file' },
      { key: 'remarks', label: 'Remarks', type: 'textarea' },
    ],
  },
  {
    id: 'bank_transfer',
    label: 'Bank Transfer',
    collectionModeKey: 'bank_transfer',
    paymentMode: 'EXTERNAL',
    paymentSource: 'BANK_TRANSFER',
    fields: [
      { key: 'bankName', label: 'Bank Name', type: 'text', required: true },
      { key: 'utrNumber', label: 'UTR Number', type: 'text', required: true },
      { key: 'transactionId', label: 'Transaction ID', type: 'text', required: true },
      { key: 'transferDate', label: 'Transfer Date', type: 'date', required: true },
    ],
  },
  {
    id: 'cheque',
    label: 'Cheque',
    collectionModeKey: 'cheque',
    paymentMode: 'CHEQUE',
    pendingClearance: true,
    fields: [
      { key: 'chequeNumber', label: 'Cheque Number', type: 'text', required: true },
      { key: 'bankName', label: 'Bank Name', type: 'text', required: true },
      { key: 'chequeDate', label: 'Cheque Date', type: 'date', required: true },
    ],
  },
  {
    id: 'dd',
    label: 'Demand Draft',
    collectionModeKey: 'dd',
    paymentMode: 'DD',
    fields: [
      { key: 'ddNumber', label: 'DD Number', type: 'text', required: true },
      { key: 'bankName', label: 'Bank Name', type: 'text', required: true },
      { key: 'ddDate', label: 'DD Date', type: 'date', required: true },
    ],
  },
  {
    id: 'gateway',
    label: 'Online Payment Gateway',
    collectionModeKey: 'gateway',
    paymentMode: 'ONLINE',
    paymentSource: 'ERP_GATEWAY',
    usesPaymentRequest: true,
    fields: [],
  },
  {
    id: 'scholarship',
    label: 'Scholarship',
    collectionModeKey: 'scholarship',
    paymentMode: 'ADJUSTMENT',
    paymentSource: 'SCHOLARSHIP',
    fields: [
      { key: 'scholarshipScheme', label: 'Scholarship Scheme', type: 'text', required: true },
      { key: 'referenceNumber', label: 'Reference Number', type: 'text', required: true },
      { key: 'approvedAmount', label: 'Approved Amount', type: 'number', required: true },
    ],
  },
  {
    id: 'fee_waiver',
    label: 'Fee Waiver',
    collectionModeKey: 'fee_waiver',
    paymentMode: 'ADJUSTMENT',
    paymentSource: 'ADJUSTMENT',
    fields: [
      { key: 'waiverType', label: 'Waiver Type', type: 'text', required: true },
      { key: 'approvedBy', label: 'Approved By', type: 'text', required: true },
      { key: 'reason', label: 'Reason', type: 'textarea', required: true },
    ],
  },
  {
    id: 'other',
    label: 'Others',
    collectionModeKey: null,
    paymentMode: 'EXTERNAL',
    fields: [
      {
        key: 'description',
        label: 'Description',
        type: 'text',
        required: true,
        placeholder: 'NEFT, RTGS, Corporate Sponsorship…',
      },
      { key: 'referenceNumber', label: 'Reference Number', type: 'text' },
      { key: 'remarks', label: 'Remarks', type: 'textarea' },
    ],
  },
];

export function enabledDeskPaymentMethods(
  collectionModes?: Partial<Record<CollectionModeKey, boolean>>,
) {
  return DESK_PAYMENT_METHODS.filter((method) => {
    if (!method.collectionModeKey) return true;
    if (!collectionModes) return true;
    return collectionModes[method.collectionModeKey] !== false;
  });
}

export function resolveExternalReference(
  method: DeskPaymentMethodDef,
  values: DeskPaymentFormValues,
): string | undefined {
  switch (method.id) {
    case 'college_qr':
      return values.utrNumber?.trim() || values.transactionReference?.trim() || undefined;
    case 'sbi_icollect':
      return values.sbiTransactionId?.trim() || values.bankReferenceNumber?.trim() || undefined;
    case 'bank_transfer':
      return values.utrNumber?.trim() || values.transactionId?.trim() || undefined;
    case 'cheque':
      return values.chequeNumber?.trim() || undefined;
    case 'dd':
      return values.ddNumber?.trim() || undefined;
    case 'scholarship':
      return values.referenceNumber?.trim() || undefined;
    case 'fee_waiver':
      return values.waiverType?.trim() || undefined;
    case 'other':
      return values.referenceNumber?.trim() || values.description?.trim() || undefined;
    default:
      return undefined;
  }
}

export function validateDeskPaymentForm(
  method: DeskPaymentMethodDef | undefined,
  values: DeskPaymentFormValues,
  amount: number,
): string | null {
  if (!method) return 'Select a payment method before saving.';
  if (amount <= 0) return 'Select fees to collect before saving payment.';

  for (const field of method.fields) {
    if (!field.required) continue;
    if (field.type === 'readonly' || field.type === 'file') continue;
    const value = values[field.key]?.trim();
    if (!value) return `${field.label} is required.`;
  }

  if (method.id === 'scholarship') {
    const approved = Number(values.approvedAmount ?? amount);
    if (!approved || approved <= 0) return 'Approved amount is required.';
  }

  return null;
}

export function buildCollectionPayload(
  method: DeskPaymentMethodDef,
  values: DeskPaymentFormValues,
  studentId: string,
  demandIds: string[],
  amount: number,
  collectedByName?: string,
) {
  const externalReference = resolveExternalReference(method, values);
  const utrNumber = values.utrNumber?.trim() || undefined;

  return {
    studentId,
    demandIds,
    amount: method.id === 'scholarship' ? Number(values.approvedAmount ?? amount) : amount,
    paymentMode: method.paymentMode,
    paymentSource: method.paymentSource,
    externalReference,
    remarks: values.remarks?.trim() || values.reason?.trim() || undefined,
    metadata: {
      collectionMethod: method.id,
      collectionMethodLabel: method.label,
      ...values,
      utrNumber,
      transactionReference:
        values.transactionReference?.trim() ||
        values.transactionId?.trim() ||
        values.sbiTransactionId?.trim() ||
        values.bankReferenceNumber?.trim() ||
        externalReference,
      collectedByName,
      clearanceStatus: method.pendingClearance ? 'PENDING' : 'CLEARED',
    },
  };
}
