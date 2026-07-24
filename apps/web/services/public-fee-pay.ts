import { publicClient } from '@/lib/http/public-client';
import { getLoginRequestHeaders } from '@/lib/login-host';
import { getApiBaseUrl } from '@/lib/http/env';

export type PublicFeeChallenge =
  | {
      mode: 'math';
      token: string;
      expression: string;
    }
  | {
      mode: 'turnstile';
      siteKey: string;
      math: { token: string; expression: string };
    };

export type PublicUnpaidFee = {
  demandId: string;
  feeType: string;
  label: string;
  periodLabel: string | null;
  semester: string | null;
  academicYear: string | null;
  amount: number;
  fineAmount: number;
  dueDate: string | null;
  status: string;
};

export type PublicFeeLookupResult = {
  paymentSessionToken: string;
  expiresAt: string;
  lookedUpAt?: string;
  student: {
    fullName: string;
    rollNumber: string | null;
    registrationNumber?: string | null;
    programme: string | null;
    department: string | null;
    semester: number | null;
    academicYear: string | null;
    admissionBatch?: string | null;
    feePeriod?: string | null;
  };
  unpaidFees: PublicUnpaidFee[];
  totals: { unpaidCount: number; unpaidAmount: number };
};

const headers = () => getLoginRequestHeaders();

export async function fetchPublicFeeChallenge() {
  const { data } = await publicClient.get<PublicFeeChallenge>('/v1/public/fees/challenge', {
    headers: headers(),
  });
  return data;
}

export async function lookupPublicFees(payload: {
  identifier: string;
  challengeToken?: string;
  challengeAnswer?: string;
  turnstileToken?: string;
}) {
  const { data } = await publicClient.post<PublicFeeLookupResult>(
    '/v1/public/fees/lookup',
    payload,
    { headers: headers() },
  );
  return data;
}

export async function initiatePublicFeePayment(payload: {
  paymentSessionToken: string;
  demandIds: string[];
  payerEmail?: string;
  payerMobile?: string;
}) {
  const { data } = await publicClient.post('/v1/public/fees/pay/initiate', payload, {
    headers: headers(),
  });
  return data as { payment: { id: string }; checkout: Record<string, unknown> };
}

export async function verifyPublicFeeRazorpay(payload: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  paymentSessionToken?: string;
}) {
  const { data } = await publicClient.post('/v1/public/fees/pay/verify', payload, {
    headers: headers(),
  });
  return data as {
    alreadyPaid?: boolean;
    payment?: { id: string };
    receipt?: { id: string; receiptNo?: string };
    receiptId?: string;
    receiptAccessToken?: string;
  };
}

export async function simulatePublicFeePayment(payload: {
  paymentSessionToken: string;
  paymentId: string;
}) {
  const { data } = await publicClient.post('/v1/public/fees/pay/simulate-mock', payload, {
    headers: headers(),
  });
  return data as {
    alreadyPaid?: boolean;
    payment?: { id: string };
    receipt?: { id: string; receiptNo?: string };
    receiptId?: string;
    receiptAccessToken?: string;
  };
}

export async function verifyPublicReceipt(receiptNo: string) {
  const { data } = await publicClient.get('/v1/public/fees/verify-receipt', {
    params: { receiptNo },
    headers: headers(),
  });
  return data as {
    authentic: boolean;
    receiptId: string;
    receiptNo: string;
    issuedAt: string;
    amount: number;
    paymentMode: string;
    transactionId: string | null;
    student: {
      fullName: string;
      rollNumber: string | null;
      programme: string | null;
    };
    receiptAccessToken: string;
  };
}

export function publicFeeReceiptPdfUrl(
  receiptId: string,
  access: { paymentSessionToken?: string; receiptAccessToken?: string },
) {
  const qs = new URLSearchParams();
  if (access.receiptAccessToken) qs.set('receiptAccessToken', access.receiptAccessToken);
  else if (access.paymentSessionToken) qs.set('paymentSessionToken', access.paymentSessionToken);
  const base = getApiBaseUrl().replace(/\/$/, '');
  return `${base}/v1/public/fees/receipt/${receiptId}/pdf?${qs.toString()}`;
}
