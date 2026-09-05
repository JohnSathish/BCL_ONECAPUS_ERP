/**
 * Bank Transaction / UTR / Reference Number for school admission fee payments.
 * Keep in sync with apps/api/.../school-payment-transaction-ref.ts
 */

const MAX_LEN = 100;
const MIN_LEN = 4;

export function normalizeSchoolPaymentTransactionRef(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, MAX_LEN);
}

export function isValidSchoolPaymentTransactionRef(value: string): boolean {
  const v = normalizeSchoolPaymentTransactionRef(value);
  if (v.length < MIN_LEN || v.length > MAX_LEN) return false;
  return /^[A-Za-z0-9][A-Za-z0-9/\- ]*$/.test(v);
}

export function isSchoolPaymentTxnSameAsApplicationNumber(
  transactionRef: string,
  applicationNumber: string,
): boolean {
  const txn = normalizeSchoolPaymentTransactionRef(transactionRef).toLowerCase();
  const appNo = applicationNumber.trim().toLowerCase();
  return Boolean(txn && appNo && txn === appNo);
}
