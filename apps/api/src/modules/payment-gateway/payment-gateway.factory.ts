import { BadRequestException, Injectable } from '@nestjs/common';
import { BilldeskGatewayAdapter } from './adapters/billdesk.adapter';
import { CashfreeGatewayAdapter } from './adapters/cashfree.adapter';
import { NttDataGatewayAdapter } from './adapters/nttdata.adapter';
import { RazorpayGatewayAdapter } from './adapters/razorpay.adapter';
import { StubGatewayAdapter } from './adapters/stub.adapter';
import type {
  PaymentGatewayAdapter,
  PaymentGatewayCode,
} from './interfaces/payment-gateway.types';

const STUB_CODES: PaymentGatewayCode[] = [
  'PHONEPE',
  'PAYU',
  'CCAVENUE',
  'EASEBUZZ',
  'STRIPE',
  'PAYPAL',
  'CUSTOM',
];

@Injectable()
export class PaymentGatewayFactory {
  private readonly adapters = new Map<
    PaymentGatewayCode,
    PaymentGatewayAdapter
  >();

  constructor(
    razorpay: RazorpayGatewayAdapter,
    cashfree: CashfreeGatewayAdapter,
    billdesk: BilldeskGatewayAdapter,
    nttData: NttDataGatewayAdapter,
  ) {
    this.adapters.set('RAZORPAY', razorpay);
    this.adapters.set('CASHFREE', cashfree);
    this.adapters.set('BILLDESK', billdesk);
    this.adapters.set('NTT_DATA', nttData);
    for (const code of STUB_CODES) {
      this.adapters.set(code, new StubGatewayAdapter(code));
    }
  }

  get(code: string): PaymentGatewayAdapter {
    const normalized = code.toUpperCase() as PaymentGatewayCode;
    const adapter = this.adapters.get(normalized);
    if (!adapter) {
      throw new BadRequestException(`Unsupported payment gateway: ${code}`);
    }
    return adapter;
  }

  listCodes() {
    return [...this.adapters.keys()];
  }
}
