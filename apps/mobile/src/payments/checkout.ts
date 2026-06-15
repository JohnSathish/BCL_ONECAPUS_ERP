import { Alert, Platform } from 'react-native';
import type { PaymentCheckout } from '@/types/fees';
import { pollPaymentStatus, simulateFeePayment, verifyFeePayment } from '@/services/fees';

export type CheckoutResult = {
  success: boolean;
  receiptNo?: string;
  message: string;
};

type RazorpayModule = {
  open: (opts: Record<string, unknown>) => Promise<{
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }>;
};

function loadRazorpayModule(): RazorpayModule | null {
  try {
    return require('react-native-razorpay').default as RazorpayModule;
  } catch {
    return null;
  }
}

export function isNativeRazorpayAvailable() {
  return loadRazorpayModule() != null;
}

async function tryNativeRazorpay(checkout: PaymentCheckout): Promise<{
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
} | null> {
  if (!checkout.keyId || checkout.mode !== 'LIVE') return null;

  const RazorpayCheckout = loadRazorpayModule();
  if (!RazorpayCheckout) return null;

  try {
    return await RazorpayCheckout.open({
      key: checkout.keyId,
      amount: Math.round(checkout.amount * 100),
      currency: checkout.currency,
      name: 'College Fees',
      description: 'Outstanding fee payment',
      order_id: checkout.orderId,
      theme: { color: '#1a2b4b' },
    });
  } catch (err) {
    const code =
      typeof err === 'object' && err && 'code' in err ? Number((err as { code?: number }).code) : 0;
    if (code === 0 || code === 2) return null;
    throw err;
  }
}

export async function completeFeeCheckout(checkout: PaymentCheckout): Promise<CheckoutResult> {
  if (checkout.mode === 'SAFE_MOCK' && checkout.paymentId) {
    const res = await simulateFeePayment(checkout.paymentId);
    return {
      success: true,
      receiptNo: res.receipt?.receiptNo,
      message: `Payment successful${res.receipt?.receiptNo ? ` — receipt ${res.receipt.receiptNo}` : ''}.`,
    };
  }

  const native = await tryNativeRazorpay(checkout);
  if (native) {
    const res = await verifyFeePayment(native);
    return {
      success: true,
      receiptNo: res.receipt?.receiptNo,
      message: res.alreadyPaid
        ? 'Payment was already recorded.'
        : `Payment received${res.receipt?.receiptNo ? ` — receipt ${res.receipt.receiptNo}` : ''}.`,
    };
  }

  if (checkout.mode === 'LIVE') {
    const needsDevBuild = Platform.OS !== 'web' && !isNativeRazorpayAvailable();
    return new Promise((resolve) => {
      Alert.alert(
        'Complete payment',
        needsDevBuild
          ? 'Native Razorpay requires an EAS development build (not Expo Go). Install the dev build, or pay via the college web portal and tap "Check status".'
          : Platform.OS === 'web'
            ? 'Razorpay checkout on web is not wired yet. Use the student web portal or a native dev build.'
            : 'Could not open Razorpay. Pay via the college web portal, then tap "Check status".',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve({ success: false, message: 'Payment cancelled' }),
          },
          {
            text: 'Check status',
            onPress: async () => {
              try {
                const status = await pollPaymentStatus(checkout.orderId);
                if (status.payment?.status === 'SUCCESS' || status.status === 'SUCCESS') {
                  resolve({ success: true, message: 'Payment confirmed.' });
                } else {
                  resolve({ success: false, message: `Payment status: ${status.status}` });
                }
              } catch (e) {
                resolve({
                  success: false,
                  message: e instanceof Error ? e.message : 'Could not verify payment',
                });
              }
            },
          },
        ],
      );
    });
  }

  throw new Error('Online payment is not configured.');
}
