import { describe, it, expect } from 'vitest';
import {
  normalizePakistaniPhone,
  phoneDigits,
  buildWhatsAppLink,
  CreateVendorSchema,
  UpdateVendorSchema,
  hasVendorContact,
  VENDOR_CONTACT_ERROR,
  PakistaniMobilePhoneSchema,
  PAKISTANI_PHONE_ERROR,
} from '@apartment/shared';

/**
 * Phone normalization is the one place where "any reasonable way the admin
 * typed it" becomes the single stored value (+92XXXXXXXXXX). If this drifts,
 * vendor search and the wa.me link drift with it.
 */
describe('normalizePakistaniPhone', () => {
  it('normalizes every common way of writing the same mobile number', () => {
    const expected = '+923001234567';
    const inputs = [
      '0300-1234567',
      '03001234567',
      '0300 1234567',
      '+92 300 1234567',
      '+92-300-1234567',
      '+923001234567',
      '923001234567',
      '3001234567',
      '300 1234567',
      '0092 300 1234567',
      '00923001234567',
      '+92 (0) 300 1234567',
      '  +92 300 1234567  ',
    ];

    for (const input of inputs) {
      expect(normalizePakistaniPhone(input), input).toBe(expected);
    }
  });

  it('keeps a different valid mobile intact', () => {
    expect(normalizePakistaniPhone('0321 4567890')).toBe('+923214567890');
  });

  it('returns null for numbers that are too short', () => {
    expect(normalizePakistaniPhone('0300-123')).toBeNull();
    expect(normalizePakistaniPhone('3001234')).toBeNull();
    expect(normalizePakistaniPhone('12345')).toBeNull();
  });

  it('returns null for non-mobile Pakistani numbers', () => {
    // Karachi landline (021...) and PTCL-style numbers are not mobiles.
    expect(normalizePakistaniPhone('021-34567890')).toBeNull();
    expect(normalizePakistaniPhone('+92 21 34567890')).toBeNull();
    // Mobile prefixes in Pakistan start with 3 after the country code.
    expect(normalizePakistaniPhone('02001234567')).toBeNull();
    expect(normalizePakistaniPhone('+92 400 1234567')).toBeNull();
  });

  it('returns null for foreign numbers', () => {
    expect(normalizePakistaniPhone('+1 555 123 4567')).toBeNull();
    expect(normalizePakistaniPhone('+971 50 1234567')).toBeNull();
    expect(normalizePakistaniPhone('0044 7700 900123')).toBeNull();
  });

  it('returns null for letters, empty and non-string input', () => {
    expect(normalizePakistaniPhone('call me maybe')).toBeNull();
    expect(normalizePakistaniPhone('abc')).toBeNull();
    expect(normalizePakistaniPhone('')).toBeNull();
    expect(normalizePakistaniPhone('   ')).toBeNull();
    expect(normalizePakistaniPhone(undefined)).toBeNull();
    expect(normalizePakistaniPhone(923001234567)).toBeNull();
  });
});

describe('phoneDigits', () => {
  it('strips every non-digit character', () => {
    expect(phoneDigits('+92 300-1234567')).toBe('923001234567');
    expect(phoneDigits('0300 123 4567')).toBe('03001234567');
    expect(phoneDigits('no digits here')).toBe('');
  });
});

describe('buildWhatsAppLink', () => {
  it('strips the leading + and URL-encodes the message', () => {
    const link = buildWhatsAppLink('+923001234567', 'Hello & welcome\nto the job');
    expect(link).toBe(
      `https://wa.me/923001234567?text=${encodeURIComponent('Hello & welcome\nto the job')}`
    );
    expect(link).not.toContain('+92');
    expect(link).toContain('%26'); // the ampersand, not a query separator
  });
});

describe('PakistaniMobilePhoneSchema', () => {
  it('accepts messy input and outputs E.164', () => {
    const result = PakistaniMobilePhoneSchema.safeParse(' 0300-1234567 ');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('+923001234567');
  });

  it('rejects invalid input with a clear message', () => {
    const result = PakistaniMobilePhoneSchema.safeParse('+1 555 123 4567');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(PAKISTANI_PHONE_ERROR);
    }
  });
});

describe('CreateVendorSchema', () => {
  it('normalizes the phone and treats an empty email as null', () => {
    const result = CreateVendorSchema.safeParse({
      name: '  Sunrise Plumbing  ',
      phone: '0300 1234567',
      email: '',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        name: 'Sunrise Plumbing',
        phone: '+923001234567',
        email: null,
      });
    }
  });

  it('requires a name', () => {
    const result = CreateVendorSchema.safeParse({ name: '   ', phone: '03001234567' });
    expect(result.success).toBe(false);
  });

  it('rejects a vendor with neither channel', () => {
    const result = CreateVendorSchema.safeParse({ name: 'Sunrise Plumbing' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((i) => i.message)).toContain(VENDOR_CONTACT_ERROR);
    }
  });

  it('rejects an invalid contact email', () => {
    const result = CreateVendorSchema.safeParse({
      name: 'Sunrise Plumbing',
      phone: '03001234567',
      email: 'not-an-email',
    });
    expect(result.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// At least one contact channel - not both. This rule decides who gets an
// automatic email and who needs the admin's manual WhatsApp hand-off, so it is
// asserted at the schema level (one rule, shared by create + update).
// ─────────────────────────────────────────────────────────────────────────────
describe('vendor contact channels (email OR phone)', () => {
  it('accepts an email-only vendor, with no phone at all', () => {
    const result = CreateVendorSchema.safeParse({
      name: 'City Electrician',
      email: 'city@example.com',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ name: 'City Electrician', phone: null, email: 'city@example.com' });
    }
  });

  it('accepts a phone-only vendor, with no email at all', () => {
    const result = CreateVendorSchema.safeParse({
      name: 'Bilal Handyman',
      phone: '0300 1234567',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBe('+923001234567');
      expect(result.data.email ?? null).toBeNull();
    }
  });

  it('accepts both channels', () => {
    const result = CreateVendorSchema.safeParse({
      name: 'Sunrise Plumbing',
      phone: '03001234567',
      email: 'plumbing@example.com',
    });
    expect(result.success).toBe(true);
  });

  it('treats blank strings as "no contact" and refuses the request', () => {
    // What an empty form actually submits: the fields exist but are blank.
    for (const payload of [
      { name: 'Ghost Vendor', phone: '', email: '' },
      { name: 'Ghost Vendor', phone: '   ', email: '  ' },
      { name: 'Ghost Vendor', phone: null, email: null },
    ]) {
      const result = CreateVendorSchema.safeParse(payload);
      expect(result.success, JSON.stringify(payload)).toBe(false);
      if (!result.success) {
        expect(result.error.issues.map((i) => i.message)).toContain(VENDOR_CONTACT_ERROR);
      }
    }
  });

  it('never crashes the refinement on a half-parsed object (a 400, not a 500)', () => {
    // Zod still runs object refinements when a field-level parse aborted, so the
    // shared helper can be handed `undefined`. It must answer, not throw.
    expect(hasVendorContact(undefined)).toBe(false);
    expect(hasVendorContact(null)).toBe(false);
    expect(hasVendorContact({})).toBe(false);
    expect(hasVendorContact({ phone: null, email: null })).toBe(false);
    expect(hasVendorContact({ phone: '  ' })).toBe(false);
    expect(hasVendorContact({ phone: '+923001234567' })).toBe(true);
    expect(hasVendorContact({ email: 'a@b.com' })).toBe(true);

    // The malformed-name case from the API: field error + refinement, no throw.
    const result = CreateVendorSchema.safeParse({ name: '', phone: '' });
    expect(result.success).toBe(false);
  });

  it('allows an update that clears one channel but not the last one', () => {
    // `{ phone: null }` on its own is a legal patch: the route checks the merged
    // record to decide whether it actually left the vendor unreachable.
    expect(UpdateVendorSchema.safeParse({ phone: null }).success).toBe(true);
    expect(UpdateVendorSchema.safeParse({ email: null }).success).toBe(true);
    expect(UpdateVendorSchema.safeParse({ name: 'Renamed' }).success).toBe(true);
  });

  it('rejects an update that clears both channels in one patch', () => {
    const result = UpdateVendorSchema.safeParse({ phone: null, email: null });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((i) => i.message)).toContain(VENDOR_CONTACT_ERROR);
    }
    expect(UpdateVendorSchema.safeParse({ phone: '', email: '' }).success).toBe(false);
  });
});
