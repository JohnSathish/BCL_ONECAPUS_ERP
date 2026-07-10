export type PaymentGatewayCode =
  | 'RAZORPAY'
  | 'BILLDESK'
  | 'CASHFREE'
  | 'NTT_DATA'
  | 'PHONEPE'
  | 'PAYU'
  | 'CCAVENUE'
  | 'EASEBUZZ'
  | 'STRIPE'
  | 'PAYPAL'
  | 'CUSTOM';

export type PaymentGatewayMode = 'TEST' | 'LIVE';

export type PaymentGatewayStatus = 'ENABLED' | 'DISABLED';

export interface PaymentGatewayCredentials {
  providerCode: PaymentGatewayCode;
  mode: PaymentGatewayMode;
  merchantId?: string | null;
  keyId: string;
  keySecret: string;
  webhookSecret?: string | null;
  successUrl?: string | null;
  failureUrl?: string | null;
}

export interface CreateOrderInput {
  amountPaise: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface CreateOrderResult {
  orderId: string;
  amount: number;
  currency: string;
  paymentSessionId?: string;
  checkoutUrl?: string;
  bdOrderId?: string;
  authToken?: string;
  atomTokenId?: string;
  raw?: unknown;
}

export interface VerifyPaymentInput {
  orderId: string;
  paymentId: string;
  signature: string;
}

export interface PaymentGatewayAdapter {
  readonly code: PaymentGatewayCode;
  isConfigured(credentials: PaymentGatewayCredentials): boolean;
  testConnection(credentials: PaymentGatewayCredentials): Promise<{
    ok: boolean;
    message: string;
    latencyMs?: number;
  }>;
  createOrder(
    credentials: PaymentGatewayCredentials,
    input: CreateOrderInput,
  ): Promise<CreateOrderResult>;
  verifyPayment(
    credentials: PaymentGatewayCredentials,
    input: VerifyPaymentInput,
  ): boolean | Promise<boolean>;
  verifyWebhook(
    credentials: PaymentGatewayCredentials,
    rawBody: string,
    signature: string | undefined,
    context?: { timestamp?: string },
  ): boolean;
}

export interface CheckoutSession {
  provider: PaymentGatewayCode;
  orderId: string;
  amount: number;
  currency: string;
  keyId?: string;
  mode: PaymentGatewayMode | 'SAFE_MOCK';
  paymentId?: string;
  paymentSessionId?: string;
  checkoutUrl?: string;
  bdOrderId?: string;
  authToken?: string;
  merchantId?: string;
  atomTokenId?: string;
}
