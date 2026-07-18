import { api } from '@/services/api';

export type FeeSettlementBatch = {
  id: string;
  tenantId: string;
  provider: string;
  fileName?: string | null;
  settlementDate?: string | null;
  status: string;
  rowCount: number;
  matchedCount: number;
  exceptionCount: number;
  reconciledCount: number;
  remarks?: string | null;
  createdAt: string;
  updatedAt: string;
  dashboard?: FeeSettlementDashboard;
};

export type FeeSettlementDashboard = {
  kpis: {
    totalLines: number;
    matched: number;
    reconciled: number;
    exceptions: number;
    unmatched: number;
    amountMismatch: number;
    duplicates: number;
    totalGross: number;
    totalNet: number;
  };
  byStatus: Record<string, { count: number; amount: number }>;
  recentBatches: FeeSettlementBatch[];
};

export type FeeSettlementLine = {
  id: string;
  batchId: string;
  lineNo: number;
  gatewayTransactionId?: string | null;
  gatewayPaymentId?: string | null;
  gatewayOrderId?: string | null;
  utr?: string | null;
  receiptNo?: string | null;
  studentIdentifier?: string | null;
  grossAmount: number;
  feeCharges: number;
  taxAmount: number;
  netAmount: number;
  settlementDate?: string | null;
  matchStatus: string;
  matchMethod?: string | null;
  paymentId?: string | null;
  amountDifference?: number | null;
  remarks?: string | null;
  payment?: {
    id: string;
    transactionNo: string;
    amount: number;
    status: string;
    studentName?: string | null;
    admissionNo?: string | null;
    reconStatus?: string;
  } | null;
};

export async function fetchSettlementDashboard(batchId?: string) {
  const { data } = await api.get<FeeSettlementDashboard>(
    '/v1/fees/settlement-reconciliation/dashboard',
    { params: batchId ? { batchId } : undefined },
  );
  return data;
}

export async function fetchSettlementBatches(limit = 20) {
  const { data } = await api.get<FeeSettlementBatch[]>(
    '/v1/fees/settlement-reconciliation/batches',
    { params: { limit } },
  );
  return data;
}

export async function fetchSettlementLines(params?: {
  batchId?: string;
  matchStatus?: string;
  exceptionsOnly?: boolean;
  limit?: number;
}) {
  const { data } = await api.get<FeeSettlementLine[]>('/v1/fees/settlement-reconciliation/lines', {
    params: {
      batchId: params?.batchId,
      matchStatus: params?.matchStatus,
      exceptionsOnly: params?.exceptionsOnly ? '1' : undefined,
      limit: params?.limit,
    },
  });
  return data;
}

export async function importSettlementCsv(
  file: File,
  opts?: { provider?: string; remarks?: string; autoMatch?: boolean },
) {
  const form = new FormData();
  form.append('file', file);
  if (opts?.provider) form.append('provider', opts.provider);
  if (opts?.remarks) form.append('remarks', opts.remarks);
  if (opts?.autoMatch === false) form.append('autoMatch', '0');
  const { data } = await api.post<FeeSettlementBatch>(
    '/v1/fees/settlement-reconciliation/import',
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data;
}

export async function rematchSettlementBatch(batchId: string) {
  const { data } = await api.post<FeeSettlementBatch>(
    `/v1/fees/settlement-reconciliation/batches/${batchId}/match`,
  );
  return data;
}

export async function markSettlementLineReconciled(lineId: string, remarks?: string) {
  const { data } = await api.post<FeeSettlementLine>(
    `/v1/fees/settlement-reconciliation/lines/${lineId}/reconcile`,
    { remarks },
  );
  return data;
}

export async function markSettlementLineManualReview(lineId: string, remarks?: string) {
  const { data } = await api.post<FeeSettlementLine>(
    `/v1/fees/settlement-reconciliation/lines/${lineId}/manual-review`,
    { remarks },
  );
  return data;
}

export async function linkSettlementLinePayment(
  lineId: string,
  paymentId: string,
  remarks?: string,
) {
  const { data } = await api.post<FeeSettlementLine>(
    `/v1/fees/settlement-reconciliation/lines/${lineId}/link`,
    { paymentId, remarks },
  );
  return data;
}

export async function updateSettlementLineRemarks(lineId: string, remarks: string) {
  const { data } = await api.patch<FeeSettlementLine>(
    `/v1/fees/settlement-reconciliation/lines/${lineId}/remarks`,
    { remarks },
  );
  return data;
}

export async function downloadSettlementTemplate() {
  const res = await api.get('/v1/fees/settlement-reconciliation/template', {
    responseType: 'blob',
  });
  triggerDownload(res.data, 'fee-settlement-template.csv');
}

export async function downloadSettlementReconExport(params?: {
  batchId?: string;
  matchStatus?: string;
  report?: 'daily' | 'exceptions' | 'all';
}) {
  const res = await api.get('/v1/fees/settlement-reconciliation/export', {
    params: {
      batchId: params?.batchId,
      matchStatus: params?.matchStatus,
      report: params?.report ?? 'all',
      exceptionsOnly: params?.report === 'exceptions' ? '1' : undefined,
    },
    responseType: 'blob',
  });
  const stamp = new Date().toISOString().slice(0, 10);
  const name =
    params?.report === 'exceptions'
      ? `fee-recon-exceptions-${stamp}.csv`
      : params?.report === 'daily'
        ? `fee-recon-daily-${stamp}.csv`
        : `fee-recon-${stamp}.csv`;
  triggerDownload(res.data, name);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
