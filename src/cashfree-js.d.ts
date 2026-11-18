declare module '@cashfreepayments/cashfree-js' {
  export interface CashfreeLoadOptions {
    mode: 'sandbox' | 'production';
  }

  export interface CashfreeCheckoutOptions {
    paymentSessionId: string;
    redirectTarget?: '_self' | '_blank' | '_top' | '_modal' | HTMLElement;
    returnUrl?: string;
  }

  export interface CashfreeCheckoutResult {
    error?: {
      message?: string;
      code?: string;
      type?: string;
    };
    redirect?: boolean;
    paymentDetails?: {
      paymentMessage?: string;
    };
  }

  export interface CashfreeInstance {
    checkout: (options: CashfreeCheckoutOptions) => Promise<CashfreeCheckoutResult>;
  }

  export function load(options: CashfreeLoadOptions): Promise<CashfreeInstance | null>;
}
