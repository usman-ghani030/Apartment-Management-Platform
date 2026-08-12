import crypto from 'node:crypto';

/**
 * PaymentProvider — the single abstraction for payment gateways (ADR 003).
 *
 * No route handler may call the Safepay API directly; everything goes through
 * this interface so a future provider swap is a contained change.
 */
export interface PaymentProvider {
  /** Whether the gateway keys are configured (otherwise the app uses offline mode). */
  isConfigured(): boolean;
  /**
   * Create a hosted-checkout session for one invoice and return the redirect URL.
   * Amounts are in the lowest denomination (paisa) — Safepay expects that too.
   */
  createCheckoutSession(params: {
    invoiceId: string;
    title: string;
    amount: number;
    redirectUrl: string;
    cancelUrl: string;
  }): Promise<{ url: string; trackerToken: string }>;
  /** Verify an incoming webhook's signature over the RAW request body. */
  verifyWebhookSignature(rawBody: string, signature: string): boolean;
  /** Normalize a verified webhook payload into a typed event. */
  parseWebhookEvent(payload: unknown): WebhookEvent;
  /** Server-side status check of a tracker — used as a reconciliation fallback only. */
  verifyPayment(trackerToken: string): Promise<'succeeded' | 'failed' | 'unknown'>;
}

export type WebhookEvent = {
  type: 'succeeded' | 'failed' | 'ignored';
  trackerToken?: string;
  txnRef?: string;
  orderId?: string;
};

export class PaymentProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentProviderError';
  }
}

// ── Safepay implementation ──────────────────────────────────────────────────
//
// Contract (verified against Safepay's official SDKs — @sfpy/node-core and the
// safepay-checkout-woocommerce plugin):
//   1. POST {base}/client/passport/v1/token   → tbt (time-based token)
//   2. POST {base}/order/payments/v3/         → { data: { tracker: { token } } }  (HTTP 201)
//   3. Redirect resident to {checkoutBase}/embedded/?tbt=&tracker=&order_id=&environment=&source=&redirect_url=&cancel_url=
// Webhooks arrive with header X-SFPY-SIGNATURE = HMAC-SHA512(rawBody, webhookSecret),
// payload { data: { tracker, state, metadata: { order_id } } }, success state = TRACKER_ENDED.
const API_BASE: Record<string, string> = {
  sandbox: 'https://sandbox.api.getsafepay.com',
  production: 'https://api.getsafepay.com',
};
const CHECKOUT_BASE: Record<string, string> = {
  sandbox: 'https://sandbox.api.getsafepay.com',
  production: 'https://getsafepay.com',
};
const REQUEST_TIMEOUT_MS = 30_000;

interface SafepayConfig {
  merchantApiKey: string;
  merchantSecret: string;
  webhookSecret: string | null;
  environment: 'sandbox' | 'production';
}

function readConfig(): SafepayConfig | null {
  const merchantApiKey = process.env.SAFEPAY_PUBLIC_KEY?.trim() || '';
  const merchantSecret = process.env.SAFEPAY_PRIVATE_KEY?.trim() || '';
  if (!merchantApiKey || !merchantSecret) return null;
  const environment = (process.env.SAFEPAY_ENV?.trim() || 'sandbox') === 'production' ? 'production' : 'sandbox';
  return {
    merchantApiKey,
    merchantSecret,
    webhookSecret: process.env.SAFEPAY_WEBHOOK_SECRET?.trim() || null,
    environment,
  };
}

/**
 * Extract a short, non-sensitive reason from a Safepay error body
 * ({ status: { errors: [...] } }). Never logs raw request/response bodies
 * that could contain card data.
 */
function safepayErrorDetail(json: any): string {
  try {
    const errors = json?.status?.errors;
    if (Array.isArray(errors)) return JSON.stringify(errors).slice(0, 200);
    if (typeof errors === 'string') return errors.slice(0, 200);
    if (json && typeof json === 'object') {
      const msg = json.message ?? json.error;
      if (typeof msg === 'string') return msg.slice(0, 200);
    }
  } catch { /* never let logging break the flow */ }
  return '(no error detail returned by Safepay)';
}

/** Tiny fetch wrapper with a timeout; returns parsed JSON and the HTTP status. */
async function safepayFetch(url: string, body: unknown, secret: string): Promise<{ status: number; json: any }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SFPY-MERCHANT-SECRET': secret,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      // Non-JSON error body — log a truncated snippet below, never the full body if sensitive.
      json = null;
    }
    return { status: res.status, json };
  } finally {
    clearTimeout(timer);
  }
}

class SafepayPaymentProvider implements PaymentProvider {
  isConfigured(): boolean {
    return readConfig() !== null;
  }

  async createCheckoutSession(params: {
    invoiceId: string;
    title: string;
    amount: number;
    redirectUrl: string;
    cancelUrl: string;
  }): Promise<{ url: string; trackerToken: string }> {
    const config = readConfig();
    if (!config) {
      throw new PaymentProviderError('Safepay is not configured');
    }
    const apiBase = API_BASE[config.environment];

    // Step 1 — passport token (tbt)
    const tokenRes = await safepayFetch(`${apiBase}/client/passport/v1/token`, {}, config.merchantSecret);
    if (tokenRes.status < 200 || tokenRes.status >= 300) {
      console.error(`[Safepay] Token request failed (HTTP ${tokenRes.status}): ${safepayErrorDetail(tokenRes.json)}`);
      throw new PaymentProviderError(`Safepay token request failed (HTTP ${tokenRes.status})`);
    }
    const rawTbt = tokenRes.json?.data;
    const tbt = typeof rawTbt === 'string' ? rawTbt : rawTbt?.token;
    if (!tbt) {
      throw new PaymentProviderError('Safepay returned no checkout token (passport)');
    }

    // Step 2 — create the tracker for this invoice
    const txRes = await safepayFetch(`${apiBase}/order/payments/v3/`, {
      amount: params.amount,
      intent: 'CYBERSOURCE',
      mode: 'payment',
      currency: 'PKR',
      merchant_api_key: config.merchantApiKey,
      order_id: params.invoiceId,
      source: 'omnihome',
    }, config.merchantSecret);
    if (txRes.status !== 201 && txRes.status !== 200) {
      // Log the status and a truncated, non-sensitive Safepay error reason — never raw payloads.
      console.error(`[Safepay] Tracker creation failed (HTTP ${txRes.status}) for invoice ${params.invoiceId}: ${safepayErrorDetail(txRes.json)}`);
      throw new PaymentProviderError(`Safepay could not start a checkout (HTTP ${txRes.status})`);
    }
    const trackerToken: string | undefined = txRes.json?.data?.tracker?.token;
    if (!trackerToken) {
      throw new PaymentProviderError('Safepay returned no checkout token');
    }

    // Step 3 — hosted checkout URL (redirect flow)
    const query = new URLSearchParams({
      tbt: tbt || '',
      tracker: trackerToken,
      order_id: params.invoiceId,
      environment: config.environment,
      source: 'omnihome',
      redirect_url: params.redirectUrl,
      cancel_url: params.cancelUrl,
    });
    const url = `${CHECKOUT_BASE[config.environment]}/embedded/?${query.toString()}`;
    return { url, trackerToken };
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const config = readConfig();
    if (!config?.webhookSecret || !rawBody || !signature) return false;
    const secret = config.webhookSecret;

    const compute = (payload: string) => crypto.createHmac('sha512', secret).update(payload).digest('hex');
    // timingSafeEqual throws on length mismatch — guard first (attacker-controlled input).
    const secureEqual = (a: string, b: string): boolean => {
      const expected = Buffer.from(a, 'hex');
      const provided = Buffer.from(b, 'hex');
      return provided.length === expected.length && crypto.timingSafeEqual(expected, provided);
    };

    // Primary: Safepay's docs require verifying over the raw body exactly as received.
    const expected = compute(rawBody);
    if (secureEqual(expected, signature) || expected === signature) {
      return true;
    }
    // Fallback: Safepay's PHP SDK signs a normalized re-encode (JSON_UNESCAPED_SLASHES).
    try {
      const normalized = JSON.stringify(JSON.parse(rawBody));
      const normalizedExpected = compute(normalized);
      if (secureEqual(normalizedExpected, signature) || normalizedExpected === signature) return true;
    } catch {
      // Not JSON — nothing else to try.
    }
    return false;
  }

  parseWebhookEvent(payload: unknown): WebhookEvent {
    if (!payload || typeof payload !== 'object') return { type: 'ignored' };
    const data = (payload as any).data;
    if (!data || typeof data !== 'object') return { type: 'ignored' };

    const trackerToken: string | undefined = data.tracker;
    const state: string | undefined = data.state;
    const orderId: string | undefined = data.metadata?.order_id;

    if (state === 'TRACKER_ENDED') {
      return { type: 'succeeded', trackerToken, txnRef: trackerToken, orderId };
    }
    if (trackerToken) {
      return { type: 'failed', trackerToken, orderId };
    }
    return { type: 'ignored' };
  }

  async verifyPayment(trackerToken: string): Promise<'succeeded' | 'failed' | 'unknown'> {
    const config = readConfig();
    if (!config || !trackerToken) return 'unknown';
    try {
      const apiBase = API_BASE[config.environment];
      const res = await safepayFetch(`${apiBase}/order/payments/v3/${encodeURIComponent(trackerToken)}`, {}, config.merchantSecret);
      if (res.status < 200 || res.status >= 300) return 'unknown';
      const state: string | undefined =
        res.json?.data?.state ?? res.json?.data?.tracker?.state ?? res.json?.tracker?.state;
      if (state === 'TRACKER_ENDED') return 'succeeded';
      if (state && /FAIL|DECLINED|CANCELLED|EXPIRED/i.test(state)) return 'failed';
      return 'unknown';
    } catch (err) {
      console.error('[Safepay] verifyPayment failed:', err instanceof Error ? err.message : err);
      return 'unknown';
    }
  }
}

const safepayProvider = new SafepayPaymentProvider();

/** Returns the configured payment provider (Safepay when keys are present). */
export function getPaymentProvider(): PaymentProvider {
  return safepayProvider;
}
