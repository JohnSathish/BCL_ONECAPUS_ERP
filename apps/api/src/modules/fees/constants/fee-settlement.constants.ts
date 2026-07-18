export const FEE_SETTLEMENT_MATCH_STATUSES = [
  'PENDING',
  'MATCHED',
  'RECONCILED',
  'AMOUNT_MISMATCH',
  'DUPLICATE',
  'UNMATCHED',
  'MANUAL_REVIEW',
  'SETTLEMENT_PENDING',
] as const;

export type FeeSettlementMatchStatus =
  (typeof FEE_SETTLEMENT_MATCH_STATUSES)[number];

export const FEE_SETTLEMENT_MATCH_METHODS = [
  'TXN_ID',
  'GATEWAY_REF',
  'UTR',
  'RECEIPT',
  'STUDENT_AMOUNT_DATE',
  'MANUAL',
] as const;

export type FeeSettlementMatchMethod =
  (typeof FEE_SETTLEMENT_MATCH_METHODS)[number];

export const FEE_PAYMENT_RECON_STATUSES = [
  'UNRECONCILED',
  'MATCHED',
  'RECONCILED',
  'EXCEPTION',
] as const;

export const EXCEPTION_MATCH_STATUSES: FeeSettlementMatchStatus[] = [
  'AMOUNT_MISMATCH',
  'DUPLICATE',
  'UNMATCHED',
  'MANUAL_REVIEW',
  'SETTLEMENT_PENDING',
];

export const MATCH_STATUS_LABELS: Record<FeeSettlementMatchStatus, string> = {
  PENDING: 'Pending',
  MATCHED: 'Matched',
  RECONCILED: 'Reconciled',
  AMOUNT_MISMATCH: 'Amount mismatch',
  DUPLICATE: 'Duplicate',
  UNMATCHED: 'Unmatched',
  MANUAL_REVIEW: 'Manual review',
  SETTLEMENT_PENDING: 'Settlement pending',
};

/** Normalized header → field. Generic aliases apply to all providers. */
export const SETTLEMENT_HEADER_ALIASES: Record<string, string> = {
  payment_id: 'gatewayPaymentId',
  paymentid: 'gatewayPaymentId',
  gateway_payment_id: 'gatewayPaymentId',
  entity_id: 'gatewayPaymentId',
  razorpay_payment_id: 'gatewayPaymentId',
  order_id: 'gatewayOrderId',
  orderid: 'gatewayOrderId',
  gateway_order_id: 'gatewayOrderId',
  razorpay_order_id: 'gatewayOrderId',
  transaction_id: 'gatewayTransactionId',
  txn_id: 'gatewayTransactionId',
  transactionid: 'gatewayTransactionId',
  gateway_transaction_id: 'gatewayTransactionId',
  merchant_tran_id: 'gatewayTransactionId',
  utr: 'utr',
  settlement_utr: 'utr',
  bank_utr: 'utr',
  bank_reference: 'utr',
  bank_ref: 'utr',
  receipt_no: 'receiptNo',
  receipt_number: 'receiptNo',
  receiptno: 'receiptNo',
  student_id: 'studentIdentifier',
  admission_no: 'studentIdentifier',
  admission_number: 'studentIdentifier',
  customer_id: 'studentIdentifier',
  amount: 'grossAmount',
  payment_amount: 'grossAmount',
  gross_amount: 'grossAmount',
  credit: 'grossAmount',
  debit: 'grossAmount',
  fee: 'feeCharges',
  fee_charges: 'feeCharges',
  gateway_fee: 'feeCharges',
  charges: 'feeCharges',
  tax: 'taxAmount',
  gst: 'taxAmount',
  tax_amount: 'taxAmount',
  net: 'netAmount',
  net_amount: 'netAmount',
  credit_amount: 'netAmount',
  settled_at: 'settlementDate',
  settlement_date: 'settlementDate',
  credit_date: 'settlementDate',
  settled_on: 'settlementDate',
  currency: 'currency',
};

/** Extra aliases layered on when a provider preset is selected. */
export const PROVIDER_HEADER_PRESETS: Record<string, Record<string, string>> = {
  RAZORPAY: {
    entity_id: 'gatewayPaymentId',
    payment_id: 'gatewayPaymentId',
    order_id: 'gatewayOrderId',
    amount: 'grossAmount',
    fee: 'feeCharges',
    tax: 'taxAmount',
    debit: 'netAmount',
    credit: 'netAmount',
    settlement_utr: 'utr',
    settled_at: 'settlementDate',
  },
  BILLDESK: {
    transactionid: 'gatewayTransactionId',
    txn_ref_no: 'gatewayTransactionId',
    mercid: 'ignore',
    bank_ref_no: 'utr',
    txn_amount: 'grossAmount',
    surcharge: 'feeCharges',
    tax: 'taxAmount',
    net_amount: 'netAmount',
    txn_date: 'settlementDate',
    settlement_date: 'settlementDate',
  },
  ATOM: {
    merchanttxnid: 'gatewayTransactionId',
    atoms_txn_id: 'gatewayPaymentId',
    bank_txn_id: 'utr',
    amount: 'grossAmount',
    surcharge: 'feeCharges',
    gst: 'taxAmount',
    netamount: 'netAmount',
    txndate: 'settlementDate',
  },
  CASHFREE: {
    cf_payment_id: 'gatewayPaymentId',
    order_id: 'gatewayOrderId',
    payment_amount: 'grossAmount',
    payment_service_charge: 'feeCharges',
    payment_service_tax: 'taxAmount',
    settlement_amount: 'netAmount',
    utr: 'utr',
    settlement_date: 'settlementDate',
  },
  GENERIC: {},
};

export function resolveSettlementHeaderMap(provider?: string) {
  const preset =
    PROVIDER_HEADER_PRESETS[(provider || 'GENERIC').toUpperCase()] ?? {};
  return { ...SETTLEMENT_HEADER_ALIASES, ...preset };
}
