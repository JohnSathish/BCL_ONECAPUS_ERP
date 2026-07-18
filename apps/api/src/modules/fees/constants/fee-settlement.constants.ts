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
