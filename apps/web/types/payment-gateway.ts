export type PaymentGatewayMode = 'TEST' | 'LIVE';
export type PaymentGatewayStatus = 'ENABLED' | 'DISABLED';

export type PaymentGatewayRow = {
  id: string;
  providerCode: string;
  name: string;
  description?: string | null;
  status: PaymentGatewayStatus;
  mode: PaymentGatewayMode;
  isActive: boolean;
  merchantId?: string | null;
  successUrl?: string | null;
  failureUrl?: string | null;
  lastHealthAt?: string | null;
  lastHealthStatus?: string | null;
  configured: boolean;
  apiKeyMasked?: string | null;
  secretKeyMasked?: string | null;
  webhookSecretMasked?: string | null;
};

export type PaymentGatewayHealthRow = {
  gatewayId: string;
  providerCode: string;
  name: string;
  isActive: boolean;
  mode: PaymentGatewayMode;
  status: 'ONLINE' | 'OFFLINE' | 'DEGRADED';
  message: string;
  latencyMs?: number;
  lastCheckedAt: string;
};

export type PaymentGatewaySettings = {
  id: string;
  tenantId: string;
  allowedModes: {
    upi?: boolean;
    creditCard?: boolean;
    debitCard?: boolean;
    netBanking?: boolean;
    wallet?: boolean;
  };
  autoReceipt: boolean;
  autoEmailReceipt: boolean;
  autoSmsNotification: boolean;
  autoWhatsappNotification: boolean;
  retryFailedPayments: boolean;
  paymentTimeoutMinutes: number;
  preventDuplicatePayments: boolean;
};

export type PaymentTransactionLogRow = {
  id: string;
  transactionId: string;
  gateway: string;
  studentName?: string | null;
  rollNumber?: string | null;
  feeType?: string | null;
  amount: number;
  status: string;
  gatewayReference?: string | null;
  erpReceiptNumber?: string | null;
  paymentDate?: string | null;
  responseCode?: string | null;
  responseMessage?: string | null;
};

export type PaymentWebhookLogRow = {
  id: string;
  providerCode: string;
  eventName: string;
  verificationStatus: string;
  processingStatus: string;
  receivedAt: string;
  processedAt?: string | null;
  replayedAt?: string | null;
};

export type ConfigureGatewayPayload = {
  merchantId?: string;
  apiKey?: string;
  secretKey?: string;
  webhookSecret?: string;
  successUrl?: string;
  failureUrl?: string;
  mode?: PaymentGatewayMode;
  status?: PaymentGatewayStatus;
};
