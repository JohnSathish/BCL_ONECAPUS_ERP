import { api } from '@/services/api';
import type {
  ConfigureGatewayPayload,
  PaymentGatewayHealthRow,
  PaymentGatewayRow,
  PaymentGatewaySettings,
  PaymentTransactionLogRow,
  PaymentWebhookLogRow,
} from '@/types/payment-gateway';

export async function fetchPaymentGateways() {
  const { data } = await api.get<PaymentGatewayRow[]>('/v1/payment-gateway/gateways');
  return data;
}

export async function fetchActivePaymentGateway() {
  const { data } = await api.get<PaymentGatewayRow | null>('/v1/payment-gateway/gateways/active');
  return data;
}

export async function configurePaymentGateway(
  providerCode: string,
  payload: ConfigureGatewayPayload,
) {
  const { data } = await api.patch<PaymentGatewayRow[]>(
    `/v1/payment-gateway/gateways/${providerCode}/configure`,
    payload,
  );
  return data;
}

export async function activatePaymentGateway(providerCode: string) {
  const { data } = await api.post<PaymentGatewayRow[]>(
    `/v1/payment-gateway/gateways/${providerCode}/activate`,
  );
  return data;
}

export async function deactivatePaymentGateway(providerCode: string) {
  const { data } = await api.post<PaymentGatewayRow[]>(
    `/v1/payment-gateway/gateways/${providerCode}/deactivate`,
  );
  return data;
}

export async function enablePaymentGateway(providerCode: string) {
  const { data } = await api.post<PaymentGatewayRow[]>(
    `/v1/payment-gateway/gateways/${providerCode}/enable`,
  );
  return data;
}

export async function disablePaymentGateway(providerCode: string) {
  const { data } = await api.post<PaymentGatewayRow[]>(
    `/v1/payment-gateway/gateways/${providerCode}/disable`,
  );
  return data;
}

export async function testPaymentGateway(providerCode: string) {
  const { data } = await api.post<{ ok: boolean; message: string; latencyMs?: number }>(
    `/v1/payment-gateway/gateways/${providerCode}/test`,
  );
  return data;
}

export async function fetchPaymentGatewayHealth() {
  const { data } = await api.get<PaymentGatewayHealthRow[]>('/v1/payment-gateway/health');
  return data;
}

export async function fetchPaymentGatewaySettings() {
  const { data } = await api.get<PaymentGatewaySettings>('/v1/payment-gateway/settings');
  return data;
}

export async function updatePaymentGatewaySettings(payload: Partial<PaymentGatewaySettings>) {
  const { data } = await api.patch<PaymentGatewaySettings>('/v1/payment-gateway/settings', payload);
  return data;
}

export async function fetchPaymentTransactionLogs(params?: {
  status?: string;
  gateway?: string;
  limit?: number;
  offset?: number;
}) {
  const { data } = await api.get<{ total: number; items: PaymentTransactionLogRow[] }>(
    '/v1/payment-gateway/transactions',
    { params },
  );
  return data;
}

export async function fetchPaymentWebhookLogs(params?: {
  gateway?: string;
  processingStatus?: string;
  limit?: number;
}) {
  const { data } = await api.get<{ total: number; items: PaymentWebhookLogRow[] }>(
    '/v1/payment-gateway/webhooks',
    { params },
  );
  return data;
}

export async function replayPaymentWebhook(webhookLogId: string) {
  const { data } = await api.post<{ replayed: boolean; message?: string }>(
    '/v1/payment-gateway/webhooks/replay',
    { webhookLogId },
  );
  return data;
}

export async function fetchPaymentGatewayAuditLogs() {
  const { data } = await api.get<unknown[]>('/v1/payment-gateway/audit');
  return data;
}
