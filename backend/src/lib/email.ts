import { Resend } from 'resend';

// Lazy singleton: the Resend client is only constructed when RESEND_API_KEY is
// present, so the app (and the test suite) works without email configured.
let client: Resend | null = null;

function getClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new Resend(apiKey);
  return client;
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Send an email via Resend (the app's single email provider — PLAN.md §15).
 *
 * If RESEND_API_KEY is missing we log and continue (dev mode), matching the
 * notification-stub behavior. Sending errors are surfaced to the caller —
 * routes that must not reveal account existence (password reset) catch and log
 * them so the generic response is still returned.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  const c = getClient();
  if (!c) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[EMAIL] to=${message.to} subject="${message.subject}" (no RESEND_API_KEY — not delivered)`);
    } else {
      console.error('[EMAIL] RESEND_API_KEY is not set — email not sent');
    }
    return;
  }

  const from = process.env.EMAIL_FROM || 'OmniHome <noreply@luxesociety.com>';
  const { error } = await c.emails.send({
    from,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });
  if (error) {
    throw new Error(`Resend delivery failed: ${error.message}`);
  }
}