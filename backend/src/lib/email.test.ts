import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Nodemailer so no real SMTP connection is ever opened in tests.
const mocks = vi.hoisted(() => {
  const sendMail = vi.fn();
  const createTransport = vi.fn(() => ({ sendMail }));
  return { sendMail, createTransport };
});

vi.mock('nodemailer', () => ({
  default: { createTransport: mocks.createTransport },
}));

import { GmailSmtpEmailProvider, sendEmail, resetEmailProvider } from './email';

const CREDS = { user: 'sender@gmail.com', appPassword: 'abcd efgh ijkl mnop' };
const MESSAGE = {
  to: 'alice@example.com',
  subject: 'Reset your OmniHome password',
  html: '<p>hi</p>',
  text: 'hi',
};

describe('GmailSmtpEmailProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetEmailProvider();
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('configures the Gmail transport with the credential env values and sends the message', async () => {
    const provider = new GmailSmtpEmailProvider(CREDS);
    mocks.sendMail.mockResolvedValueOnce({ messageId: 'x' });

    await provider.sendEmail(MESSAGE);

    // SMTP details live only here - service gmail + the app-password auth.
    expect(mocks.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'gmail',
        auth: { user: CREDS.user, pass: CREDS.appPassword },
      })
    );
    // Sender defaults to the authenticated Gmail address.
    expect(mocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: CREDS.user,
        to: MESSAGE.to,
        subject: MESSAGE.subject,
        html: MESSAGE.html,
        text: MESSAGE.text,
      })
    );
  });

  it('rejects with a clear error and never leaks the app password when SMTP fails', async () => {
    const provider = new GmailSmtpEmailProvider(CREDS);
    // A realistic auth failure that (worst case) echoes the credential back.
    mocks.sendMail.mockRejectedValueOnce(
      new Error(`Invalid login: 535-5.7.8 Username and Password not accepted pass=${CREDS.appPassword}`)
    );

    let caught: Error | null = null;
    try {
      await provider.sendEmail(MESSAGE);
    } catch (err) {
      caught = err as Error;
    }

    expect(caught).not.toBeNull();
    expect(caught!.message).toContain('Gmail SMTP delivery failed');
    expect(caught!.message).not.toContain(CREDS.appPassword);
    expect(caught!.message).toContain('[redacted]');
  });
});

describe('sendEmail entry point', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetEmailProvider();
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('delivers through the configured Gmail provider', async () => {
    process.env.GMAIL_USER = CREDS.user;
    process.env.GMAIL_APP_PASSWORD = CREDS.appPassword;
    resetEmailProvider();
    mocks.sendMail.mockResolvedValueOnce({ messageId: 'x' });

    await sendEmail(MESSAGE);

    expect(mocks.createTransport).toHaveBeenCalledTimes(1);
    expect(mocks.sendMail).toHaveBeenCalledTimes(1);
  });

  it('does not throw when credentials are missing (logs instead of sending)', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await expect(sendEmail(MESSAGE)).resolves.toBeUndefined();

    expect(mocks.createTransport).not.toHaveBeenCalled();
    expect(mocks.sendMail).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('not delivered'));
  });

  it('propagates provider delivery failures to the caller', async () => {
    process.env.GMAIL_USER = CREDS.user;
    process.env.GMAIL_APP_PASSWORD = CREDS.appPassword;
    resetEmailProvider();
    mocks.sendMail.mockRejectedValueOnce(new Error('getaddrinfo ENOTFOUND smtp.gmail.com'));

    await expect(sendEmail(MESSAGE)).rejects.toThrow(/Gmail SMTP delivery failed/);
  });
});
