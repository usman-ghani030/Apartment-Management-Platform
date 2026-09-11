import nodemailer, { type Transporter } from 'nodemailer';

// ─────────────────────────────────────────────────────────────────────────────
// Email delivery (ADR 004)
//
// Every feature that sends email (password reset now; notices, ticket updates,
// dues reminders, vendor assignment later) calls `sendEmail()` below — never
// Nodemailer directly. The SMTP transport details live ONLY inside
// `GmailSmtpEmailProvider`, so swapping providers later (e.g. to a dedicated
// transactional provider once volume demands it) is a contained change: write a
// new `EmailProvider` implementation, swap the instantiation in
// `getEmailProvider()`, and no feature code moves.
// ─────────────────────────────────────────────────────────────────────────────

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailProvider {
  /** Deliver a single email. Rejects if delivery fails. */
  sendEmail(message: EmailMessage): Promise<void>;
}

export interface GmailSmtpConfig {
  user: string;
  appPassword: string;
  /** Defaults to `user` (Gmail requires the From address to match the account). */
  from?: string;
}

/**
 * Gmail SMTP implementation (Nodemailer).
 *
 * Note the known, accepted limitation from ADR 004: Gmail SMTP is capped at
 * ~500 sends/day and is not built for transactional volume — a deliberate,
 * temporary choice for the current low volume.
 */
export class GmailSmtpEmailProvider implements EmailProvider {
  private readonly transporter: Transporter;
  private readonly from: string;
  /** Held only so it can be scrubbed from any error message we emit. */
  private readonly appPassword: string;

  constructor(config: GmailSmtpConfig) {
    this.from = config.from || config.user;
    this.appPassword = config.appPassword;
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config.user,
        pass: config.appPassword,
      },
      // Bound every SMTP stage so a stalled connection rejects instead of
      // leaving the API request hanging.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }

  async sendEmail(message: EmailMessage): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
    } catch (err) {
      throw new Error(`Gmail SMTP delivery failed: ${this.sanitize(err)}`);
    }
  }

  /**
   * Never let credentials reach a log line: redact the app password and any
   * `pass=...` fragment an error may carry, then keep the message short.
   */
  private sanitize(err: unknown): string {
    const raw = err instanceof Error ? err.message : String(err);
    return raw
      .split(this.appPassword).join('[redacted]')
      .replace(/pass(word)?=\S+/gi, 'pass=[redacted]')
      .slice(0, 500);
  }
}

// ── Module-level provider singleton ─────────────────────────────────────────
// Constructed lazily on first send so the app (and the test suite) boots fine
// without email credentials configured.

let provider: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider | null {
  const user = process.env.GMAIL_USER;
  const appPassword = process.env.GMAIL_APP_PASSWORD;
  if (!user || !appPassword) return null;

  if (!provider) {
    provider = new GmailSmtpEmailProvider({ user, appPassword });
  }
  return provider;
}

/** Clear the cached provider — used by tests to isolate env-var changes. */
export function resetEmailProvider(): void {
  provider = null;
}

/**
 * The app's single email-sending entry point — all feature code calls this.
 *
 * If Gmail credentials are missing we log and continue (dev/first-run), matching
 * the notification-stub behavior. Delivery failures propagate to the caller:
 * routes that must not reveal account existence (password reset) catch and log
 * them, while callers that need to know can react.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  const p = getEmailProvider();
  if (!p) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(
        `[EMAIL] to=${message.to} subject="${message.subject}" (GMAIL_USER/GMAIL_APP_PASSWORD not set — not delivered)`
      );
    } else {
      console.error('[EMAIL] GMAIL_USER/GMAIL_APP_PASSWORD are not set — email not sent');
    }
    return;
  }

  await p.sendEmail(message);
}
