import { openRazorpayCheckout } from '@/lib/razorpay-checkout';

/** Short label for desk / portal copy (not the checkout engine). */
export function feeGatewayDisplayName(providerCode?: string | null) {
  const code = (providerCode ?? '').toUpperCase();
  if (code === 'NTT_DATA') return 'Atom';
  if (code === 'RAZORPAY') return 'Razorpay';
  if (code === 'CASHFREE') return 'Cashfree';
  if (code === 'BILLDESK') return 'BillDesk';
  if (code === 'PAYU') return 'PayU';
  if (code === 'PHONEPE') return 'PhonePe';
  if (code === 'PAYTM') return 'Paytm';
  if (code === 'CCAVENUE') return 'CCAvenue';
  return code || 'payment gateway';
}

export type FeeCheckoutPayload = {
  mode?: string;
  provider?: string;
  keyId?: string;
  orderId?: string | null;
  amount?: number;
  currency?: string;
  paymentId?: string;
  paymentSessionId?: string;
  checkoutUrl?: string;
  atomTokenId?: string;
  merchantId?: string;
  returnUrl?: string;
  custEmail?: string;
  custMobile?: string;
  requestNo?: string;
};

export type FeeCheckoutResult =
  | { kind: 'mock'; paymentId: string }
  | { kind: 'redirected' }
  | {
      kind: 'verified';
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    }
  | { kind: 'atom_opened' };

const CASHFREE_SCRIPT = 'https://sdk.cashfree.com/js/v3/cashfree.js';

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Checkout is only available in the browser'));
      return;
    }
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error(`Failed to load script ${src}`)));
      // Already loaded
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script ${src}`));
    document.body.appendChild(script);
  });
}

async function openAtomCheckout(checkout: FeeCheckoutPayload) {
  if (!checkout.atomTokenId || !checkout.merchantId) {
    throw new Error(
      'Atom checkout requires atomTokenId and merchantId. Re-activate NTT_DATA / Atom in Payment Gateway.',
    );
  }
  const isLive = checkout.mode === 'LIVE' || checkout.mode === 'PRODUCTION';
  const scriptUrl = isLive
    ? 'https://psa.atomtech.in/staticdata/ots/js/atomcheckout.js'
    : 'https://pgtest.atomtech.in/staticdata/ots/js/atomcheckout.js';
  await loadScript(scriptUrl);

  const AtomPaynetz = (
    window as unknown as { AtomPaynetz?: new (o: unknown, env: string) => unknown }
  ).AtomPaynetz;
  if (!AtomPaynetz) {
    throw new Error('Atom checkout script did not load (AtomPaynetz missing).');
  }

  const returnUrl =
    checkout.returnUrl ||
    `${window.location.origin}/admin/fees/collections?atomReturn=1&paymentId=${checkout.paymentId ?? ''}`;

  // Opens Atom hosted checkout (UPI/cards/etc. per Atom merchant config).
  new AtomPaynetz(
    {
      atomTokenId: checkout.atomTokenId,
      merchId: checkout.merchantId,
      custEmail: checkout.custEmail || 'student@college.edu',
      custMobile: checkout.custMobile || '9999999999',
      returnUrl,
    },
    isLive ? 'prod' : 'uat',
  );
}

/**
 * Routes fee desk / portal checkout to the institution's active gateway.
 */
export async function runFeeGatewayCheckout(
  checkout: FeeCheckoutPayload,
  opts?: {
    description?: string;
    onRazorpaySuccess?: (response: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    }) => Promise<void>;
  },
): Promise<FeeCheckoutResult> {
  const provider = (checkout.provider ?? '').toUpperCase();
  const paymentId = checkout.paymentId ?? '';

  if (
    (checkout.mode === 'SAFE_MOCK' || checkout.mode === 'MOCK') &&
    paymentId &&
    !checkout.atomTokenId &&
    !checkout.keyId
  ) {
    return { kind: 'mock', paymentId };
  }

  if (checkout.checkoutUrl) {
    window.location.assign(checkout.checkoutUrl);
    return { kind: 'redirected' };
  }

  if (checkout.atomTokenId || provider === 'NTT_DATA') {
    await openAtomCheckout(checkout);
    return { kind: 'atom_opened' };
  }

  if (checkout.paymentSessionId && (provider === 'CASHFREE' || !provider)) {
    await loadScript(CASHFREE_SCRIPT);
    const Cashfree = (
      window as unknown as {
        Cashfree?: (o: { mode: string }) => { checkout: (p: unknown) => Promise<void> };
      }
    ).Cashfree;
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
    return new Promise<FeeCheckoutResult>((resolve, reject) => {
      void openRazorpayCheckout({
        keyId: checkout.keyId!,
        orderId: checkout.orderId!,
        amount: Number(checkout.amount ?? 0),
        currency: checkout.currency ?? 'INR',
        name: 'College Fees',
        description: opts?.description ?? `Fee ${checkout.requestNo ?? ''}`.trim(),
        onSuccess: async (response) => {
          if (opts?.onRazorpaySuccess) {
            await opts.onRazorpaySuccess(response);
          }
          resolve({ kind: 'verified', ...response });
        },
      }).catch(reject);
    });
  }

  throw new Error(
    `Online payment is not configured for ${provider || 'the active gateway'}. ` +
      'Activate Atom (NTT_DATA) or Razorpay under Administration → Payment Gateway.',
  );
}
