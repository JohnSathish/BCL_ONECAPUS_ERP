import { openRazorpayCheckout } from '@/lib/razorpay-checkout';

export type ExamCheckoutPayload = {
  mode?: string;
  provider?: string;
  keyId?: string;
  orderId?: string;
  amount?: number;
  currency?: string;
  paymentId?: string;
  paymentTransactionId?: string;
  paymentSessionId?: string;
  checkoutUrl?: string;
  bdOrderId?: string;
  authToken?: string;
  merchantId?: string;
};

export type ExamCheckoutResult =
  | { kind: 'mock'; paymentTransactionId: string }
  | { kind: 'redirected' }
  | {
      kind: 'verified';
      paymentTransactionId: string;
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
    };

const CASHFREE_SCRIPT = 'https://sdk.cashfree.com/js/v3/cashfree.js';

function loadCashfreeScript() {
  return new Promise<void>((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Cashfree checkout is only available in the browser'));
      return;
    }
    if ((window as any).Cashfree) {
      resolve();
      return;
    }
    const existing = document.querySelector(`script[src="${CASHFREE_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Cashfree SDK')));
      return;
    }
    const script = document.createElement('script');
    script.src = CASHFREE_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Cashfree SDK'));
    document.body.appendChild(script);
  });
}

/**
 * Routes exam-fee checkout to the active gateway:
 * - SAFE_MOCK → local complete
 * - checkoutUrl (BillDesk / redirect gateways) → full-page redirect
 * - Cashfree paymentSessionId → Cashfree JS checkout
 * - Razorpay keyId+orderId → Razorpay modal
 */
export async function runExamFeeCheckout(
  checkout: ExamCheckoutPayload,
  opts?: { amountFallback?: number },
): Promise<ExamCheckoutResult> {
  const paymentTransactionId = checkout.paymentTransactionId ?? checkout.paymentId ?? '';
  const provider = (checkout.provider ?? '').toUpperCase();

  if (checkout.mode === 'SAFE_MOCK' && paymentTransactionId) {
    return { kind: 'mock', paymentTransactionId };
  }

  if (checkout.checkoutUrl) {
    window.location.assign(checkout.checkoutUrl);
    return { kind: 'redirected' };
  }

  if (checkout.paymentSessionId && (provider === 'CASHFREE' || !provider)) {
    await loadCashfreeScript();
    const Cashfree = (window as any).Cashfree;
    if (!Cashfree) throw new Error('Cashfree checkout is unavailable');
    const mode =
      checkout.mode === 'LIVE' || checkout.mode === 'PRODUCTION' ? 'production' : 'sandbox';
    const cashfree = Cashfree({ mode });
    await cashfree.checkout({
      paymentSessionId: checkout.paymentSessionId,
      redirectTarget: '_self',
    });
    return { kind: 'redirected' };
  }

  if (checkout.keyId && checkout.orderId) {
    return new Promise<ExamCheckoutResult>((resolve, reject) => {
      void openRazorpayCheckout({
        keyId: checkout.keyId!,
        orderId: checkout.orderId!,
        amount: Number(checkout.amount ?? opts?.amountFallback ?? 0),
        currency: checkout.currency ?? 'INR',
        name: 'Examination Fee',
        description: 'Semester examination fee payment',
        onSuccess: async (response) => {
          resolve({
            kind: 'verified',
            paymentTransactionId,
            ...response,
          });
        },
      }).catch(reject);
    });
  }

  throw new Error(
    `Online payment is not configured for provider ${provider || 'UNKNOWN'}. Activate a gateway under Administration → Payment Gateway.`,
  );
}
