import { api } from './api';

const base = '/v1/school-sis/accounts';

export async function fetchAcctDashboard(view?: string) {
  const { data } = await api.get(`${base}/dashboard`, { params: { view } });
  return data as Record<string, unknown>;
}

export async function fetchAcctBootstrap() {
  const { data } = await api.get(`${base}/bootstrap`);
  return data;
}

export async function fetchAcctChart() {
  const { data } = await api.get(`${base}/chart`);
  return data as Array<Record<string, unknown>>;
}

export async function saveAcctAccount(payload: Record<string, unknown>, id?: string) {
  const { data } = id
    ? await api.patch(`${base}/chart/${id}`, payload)
    : await api.post(`${base}/chart`, payload);
  return data;
}

export async function fetchAcctVouchers(params: Record<string, string | undefined>) {
  const { data } = await api.get(`${base}/vouchers`, { params });
  return data as Array<Record<string, unknown>>;
}

export async function fetchAcctVoucher(id: string) {
  const { data } = await api.get(`${base}/vouchers/${id}`);
  return data as Record<string, unknown>;
}

export async function createAcctVoucher(payload: Record<string, unknown>) {
  const { data } = await api.post(`${base}/vouchers`, payload);
  return data;
}

export async function acctVoucherAction(id: string, action: string) {
  const { data } = await api.post(`${base}/vouchers/${id}/${action}`);
  return data;
}

export async function fetchAcctLedger(accountId: string) {
  const { data } = await api.get(`${base}/ledger`, { params: { accountId } });
  return data as Record<string, unknown>;
}

export async function fetchAcctTrial() {
  const { data } = await api.get(`${base}/trial-balance`);
  return data as {
    rows: Array<Record<string, unknown>>;
    totals: { debit: string; credit: string };
  };
}

export async function fetchAcctStatements() {
  const { data } = await api.get(`${base}/statements`);
  return data as Record<string, unknown>;
}

export async function fetchAcctCashier(params?: Record<string, string>) {
  const { data } = await api.get(`${base}/cashier-collection`, { params });
  return data as Array<{ userId: string; totals: Record<string, number> }>;
}

export async function closeAcctCash(payload: Record<string, unknown>) {
  const { data } = await api.post(`${base}/cash-close`, payload);
  return data;
}

export async function fetchAcctBanks() {
  const { data } = await api.get(`${base}/banks`);
  return data as Array<Record<string, unknown>>;
}

export async function saveAcctBank(payload: Record<string, unknown>) {
  const { data } = await api.post(`${base}/banks`, payload);
  return data;
}

export async function importAcctBank(payload: Record<string, unknown>) {
  const { data } = await api.post(`${base}/banks/import`, payload);
  return data;
}

export async function fetchAcctRecon(id: string) {
  const { data } = await api.get(`${base}/banks/${id}/recon`);
  return data;
}

export async function fetchAcctVendors() {
  const { data } = await api.get(`${base}/vendors`);
  return data as Array<Record<string, unknown>>;
}

export async function saveAcctVendor(payload: Record<string, unknown>) {
  const { data } = await api.post(`${base}/vendors`, payload);
  return data;
}

export async function saveAcctBill(payload: Record<string, unknown>) {
  const { data } = await api.post(`${base}/bills`, payload);
  return data;
}

export async function fetchAcctBudgets() {
  const { data } = await api.get(`${base}/budgets`);
  return data;
}

export async function saveAcctBudget(payload: Record<string, unknown>) {
  const { data } = await api.post(`${base}/budgets`, payload);
  return data;
}

export async function fetchAcctBva() {
  const { data } = await api.get(`${base}/budget-vs-actual`);
  return data as Array<Record<string, unknown>>;
}

export async function fetchAcctCostCentres() {
  const { data } = await api.get(`${base}/cost-centres`);
  return data as Array<Record<string, unknown>>;
}

export async function fetchAcctAssets() {
  const { data } = await api.get(`${base}/assets`);
  return data as Array<Record<string, unknown>>;
}

export async function saveAcctAsset(payload: Record<string, unknown>) {
  const { data } = await api.post(`${base}/assets`, payload);
  return data;
}

export async function runAcctDepreciation(periodCode: string) {
  const { data } = await api.post(`${base}/assets/depreciate`, { periodCode });
  return data;
}

export async function fetchAcctTax() {
  const { data } = await api.get(`${base}/tax`);
  return data as Array<Record<string, unknown>>;
}

export async function saveAcctTax(payload: Record<string, unknown>) {
  const { data } = await api.post(`${base}/tax`, payload);
  return data;
}

export async function fetchAcctPeriods() {
  const { data } = await api.get(`${base}/periods`);
  return data as Array<Record<string, unknown>>;
}

export async function lockAcctPeriod(id: string) {
  const { data } = await api.post(`${base}/periods/${id}/lock`);
  return data;
}

export async function runAcctYearEnd() {
  const { data } = await api.post(`${base}/year-end`);
  return data;
}

export async function fetchAcctAudit() {
  const { data } = await api.get(`${base}/audit`);
  return data as Array<Record<string, unknown>>;
}

export async function fetchAcctRules() {
  const { data } = await api.get(`${base}/approval-rules`);
  return data as Array<Record<string, unknown>>;
}

export async function saveAcctRule(payload: Record<string, unknown>) {
  const { data } = await api.post(`${base}/approval-rules`, payload);
  return data;
}

export function acctExportUrl(key: string, format: string) {
  return `${base}/export/${key}?format=${format}`;
}
