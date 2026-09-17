import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// Hermetic DB: mock prisma so these tests never touch a real database.
vi.mock('../lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    membership: { findMany: vi.fn(), findFirst: vi.fn() },
    vendor: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import app from '../app';

const SECRET = process.env.JWT_ACCESS_SECRET || 'dev-fallback-access-secret';
const adminToken = jwt.sign({ userId: 'u-admin' }, SECRET, { expiresIn: '15m' });
const residentToken = jwt.sign({ userId: 'u-resident' }, SECRET, { expiresIn: '15m' });

const NOW = new Date();
function vendorRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'v1',
    societyId: 's1',
    name: 'Sunrise Plumbing',
    phone: '+923001234567',
    email: 'plumbing@example.com',
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    ...overrides,
  };
}

const adminMembership = {
  id: 'm-admin', userId: 'u-admin', societyId: 's1', unitId: null,
  role: 'COMMITTEE_ADMIN', status: 'ACTIVE', deletedAt: null,
  society: { name: 'Sunrise Apartments', slug: 'sunrise' },
};
const residentMembership = {
  id: 'm-res', userId: 'u-resident', societyId: 's1', unitId: 'u1',
  role: 'RESIDENT', status: 'ACTIVE', deletedAt: null,
  society: { name: 'Sunrise Apartments', slug: 'sunrise' },
};

function mockAuth(userId: string, membership: unknown) {
  (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: userId, email: `${userId}@x.com`, name: userId,
  });
  (prisma.membership.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([membership]);
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterAll(() => {
  vi.restoreAllMocks();
});

describe('GET /api/v1/vendors/search', () => {
  it('always scopes the query to the caller society (no cross-society leakage)', async () => {
    mockAuth('u-admin', adminMembership);
    (prisma.vendor.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([vendorRow()]);

    const res = await request(app)
      .get('/api/v1/vendors/search?q=plumb')
      .set('x-access-token', adminToken);

    expect(res.status).toBe(200);
    const where = (prisma.vendor.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0].where;
    expect(where.societyId).toBe('s1');
    expect(where.deletedAt).toBeNull();
  });

  it('matches on name (case-insensitive) and returns the trimmed result shape', async () => {
    mockAuth('u-admin', adminMembership);
    (prisma.vendor.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([vendorRow()]);

    const res = await request(app)
      .get('/api/v1/vendors/search?q=PLUMB')
      .set('x-access-token', adminToken);

    expect(res.status).toBe(200);
    const where = (prisma.vendor.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0].where;
    // Name-only query: no phone clause is added for a query with no digits.
    expect(where.OR).toEqual([{ name: { contains: 'PLUMB', mode: 'insensitive' } }]);
    expect(res.body.data).toEqual([
      { id: 'v1', name: 'Sunrise Plumbing', phone: '+923001234567', email: 'plumbing@example.com' },
    ]);
    // No full vendor objects (notes/createdAt) leak into the autocomplete result.
    expect(res.body.data[0]).not.toHaveProperty('createdAt');
  });

  it('matches a phone query by digits - including the national 0 form, which is not how it is stored', async () => {
    mockAuth('u-admin', adminMembership);

    // Query -> the digit patterns that must be searched for. Storage is E.164
    // (+923001234567), so a nationally-typed "0300..." also needs the pattern
    // without the trunk zero to match at all.
    const cases: [string, string[]][] = [
      ['0300 1234567', ['03001234567', '3001234567']],
      ['+92 300 123', ['92300123']],
      ['923001234567', ['923001234567']],
    ];

    for (const [q, expectedPatterns] of cases) {
      (prisma.vendor.findMany as ReturnType<typeof vi.fn>).mockClear();
      (prisma.vendor.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([vendorRow()]);

      const res = await request(app)
        .get(`/api/v1/vendors/search?q=${encodeURIComponent(q)}`)
        .set('x-access-token', adminToken);

      expect(res.status).toBe(200);
      const where = (prisma.vendor.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0].where;
      const phonePatterns = where.OR
        .filter((c: Record<string, unknown>) => 'phone' in c)
        .map((c: { phone: { contains: string } }) => c.phone.contains);
      expect(phonePatterns, q).toEqual(expectedPatterns);
    }
  });

  it('does not add a phone clause for a name query that merely contains a digit', async () => {
    mockAuth('u-admin', adminMembership);
    (prisma.vendor.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const res = await request(app)
      .get('/api/v1/vendors/search?q=' + encodeURIComponent('Tower 2 Plumbing'))
      .set('x-access-token', adminToken);

    expect(res.status).toBe(200);
    const where = (prisma.vendor.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0].where;
    expect(where.OR).toEqual([{ name: { contains: 'Tower 2 Plumbing', mode: 'insensitive' } }]);
  });

  it('returns recent vendors (no filter) for an empty query', async () => {
    mockAuth('u-admin', adminMembership);
    (prisma.vendor.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([vendorRow()]);

    const res = await request(app).get('/api/v1/vendors/search?q=').set('x-access-token', adminToken);

    expect(res.status).toBe(200);
    const args = (prisma.vendor.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(args.where.OR).toBeUndefined();
    expect(args.orderBy).toEqual({ createdAt: 'desc' });
    expect(args.take).toBe(10);
  });

  it('caps results at 10', async () => {
    mockAuth('u-admin', adminMembership);
    (prisma.vendor.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await request(app).get('/api/v1/vendors/search?q=plumb').set('x-access-token', adminToken);

    expect((prisma.vendor.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0].take).toBe(10);
  });

  it('forbids residents (403) - same audience as ticket assignment', async () => {
    mockAuth('u-resident', residentMembership);

    const res = await request(app)
      .get('/api/v1/vendors/search?q=plumb')
      .set('x-access-token', residentToken);

    expect(res.status).toBe(403);
    expect(prisma.vendor.findMany).not.toHaveBeenCalled();
  });

  it('requires authentication (401)', async () => {
    const res = await request(app).get('/api/v1/vendors/search?q=plumb');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/vendors', () => {
  it('normalizes the phone to E.164 and writes an audit entry', async () => {
    mockAuth('u-admin', adminMembership);
    (prisma.vendor.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.vendor.create as ReturnType<typeof vi.fn>).mockImplementation(({ data }) =>
      Promise.resolve(vendorRow({ name: data.name, phone: data.phone, email: data.email }))
    );

    const res = await request(app)
      .post('/api/v1/vendors')
      .set('x-access-token', adminToken)
      .send({ name: 'Sunrise Plumbing', phone: '0300-1234567', email: 'plumbing@example.com' });

    expect(res.status).toBe(201);
    expect(prisma.vendor.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ societyId: 's1', phone: '+923001234567' }),
    }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        societyId: 's1', actorUserId: 'u-admin', action: 'VENDOR_CREATED', entityType: 'vendor',
      }),
    }));
    expect(res.body.data.alreadyExisted).toBe(false);
  });

  it('reuses the existing vendor when the phone is already on file (idempotent inline create)', async () => {
    mockAuth('u-admin', adminMembership);
    (prisma.vendor.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(vendorRow());

    const res = await request(app)
      .post('/api/v1/vendors')
      .set('x-access-token', adminToken)
      .send({ name: 'Sunrise Plumbing', phone: '+92 300 1234567' });

    expect(res.status).toBe(200);
    expect(prisma.vendor.create).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(res.body.data).toMatchObject({ id: 'v1', alreadyExisted: true });

    const where = (prisma.vendor.findFirst as ReturnType<typeof vi.fn>).mock.calls[0][0].where;
    expect(where).toEqual({ societyId: 's1', phone: '+923001234567', deletedAt: null });
  });

  it('rejects an invalid phone with a clear 400', async () => {
    mockAuth('u-admin', adminMembership);

    const res = await request(app)
      .post('/api/v1/vendors')
      .set('x-access-token', adminToken)
      .send({ name: 'Sunrise Plumbing', phone: '123' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('valid Pakistani mobile number');
    expect(prisma.vendor.create).not.toHaveBeenCalled();
  });

  it('forbids residents (403)', async () => {
    mockAuth('u-resident', residentMembership);

    const res = await request(app)
      .post('/api/v1/vendors')
      .set('x-access-token', residentToken)
      .send({ name: 'Sunrise Plumbing', phone: '03001234567' });

    expect(res.status).toBe(403);
    expect(prisma.vendor.create).not.toHaveBeenCalled();
  });
});

describe('GET /api/v1/vendors/:id', () => {
  it('is tenant-scoped and 404s for another society (or a deleted vendor)', async () => {
    mockAuth('u-admin', adminMembership);
    (prisma.vendor.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await request(app).get('/api/v1/vendors/v-other').set('x-access-token', adminToken);

    expect(res.status).toBe(404);
    expect((prisma.vendor.findFirst as ReturnType<typeof vi.fn>).mock.calls[0][0].where).toEqual({
      id: 'v-other', societyId: 's1', deletedAt: null,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Contact flexibility: a vendor needs *at least one* of email/phone, not both.
// The rule lives once, in the shared schema, so every write path (the vendor
// screen and the assignment form's inline create alike) is covered below.
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/v1/vendors - at least one contact channel', () => {
  /** Echo whatever the route wrote, so the response reflects the stored row. */
  function mockCreateEcho() {
    (prisma.vendor.create as ReturnType<typeof vi.fn>).mockImplementation(({ data }) =>
      Promise.resolve(vendorRow({
        name: data.name,
        phone: data.phone ?? null,
        email: data.email ?? null,
      }))
    );
  }

  it('creates an email-only vendor (no phone at all)', async () => {
    mockAuth('u-admin', adminMembership);
    (prisma.vendor.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    mockCreateEcho();

    const res = await request(app)
      .post('/api/v1/vendors')
      .set('x-access-token', adminToken)
      .send({ name: 'City Electrician', email: 'city@example.com' });

    expect(res.status).toBe(201);
    expect(prisma.vendor.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ societyId: 's1', email: 'city@example.com', phone: null }),
    }));
    expect(res.body.data).toMatchObject({
      phone: null, email: 'city@example.com', alreadyExisted: false,
    });
  });

  it('creates a phone-only vendor (no email) with the number normalized to E.164', async () => {
    mockAuth('u-admin', adminMembership);
    (prisma.vendor.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    mockCreateEcho();

    const res = await request(app)
      .post('/api/v1/vendors')
      .set('x-access-token', adminToken)
      .send({ name: 'Bilal Handyman', phone: '0300-1234567' });

    expect(res.status).toBe(201);
    expect(prisma.vendor.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ phone: '+923001234567', email: null }),
    }));
    expect(res.body.data).toMatchObject({ phone: '+923001234567', email: null });
  });

  it('still accepts both channels (nothing regressed for existing vendors)', async () => {
    mockAuth('u-admin', adminMembership);
    (prisma.vendor.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    mockCreateEcho();

    const res = await request(app)
      .post('/api/v1/vendors')
      .set('x-access-token', adminToken)
      .send({ name: 'Sunrise Plumbing', phone: '03001234567', email: 'plumbing@example.com' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      phone: '+923001234567', email: 'plumbing@example.com',
    });
  });

  it('treats a blank phone string next to a real email as "no phone" (what the form posts)', async () => {
    mockAuth('u-admin', adminMembership);
    (prisma.vendor.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    mockCreateEcho();

    const res = await request(app)
      .post('/api/v1/vendors')
      .set('x-access-token', adminToken)
      .send({ name: 'City Electrician', phone: '', email: 'city@example.com' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ phone: null, email: 'city@example.com' });
  });

  it('rejects a vendor with neither channel with a clear 400 and writes nothing', async () => {
    mockAuth('u-admin', adminMembership);

    const res = await request(app)
      .post('/api/v1/vendors')
      .set('x-access-token', adminToken)
      .send({ name: 'Ghost Vendor' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('Add at least an email or a phone number');
    expect(prisma.vendor.create).not.toHaveBeenCalled();
    expect(prisma.vendor.findFirst).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('rejects two blank strings too - a whitespace-only attempt is not a contact (400, not 500)', async () => {
    mockAuth('u-admin', adminMembership);

    const res = await request(app)
      .post('/api/v1/vendors')
      .set('x-access-token', adminToken)
      .send({ name: 'Ghost Vendor', phone: '   ', email: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('Add at least an email or a phone number');
    expect(prisma.vendor.create).not.toHaveBeenCalled();
  });

  it('still rejects a phone that is typed but malformed, even with a valid email present', async () => {
    mockAuth('u-admin', adminMembership);

    const res = await request(app)
      .post('/api/v1/vendors')
      .set('x-access-token', adminToken)
      .send({ name: 'Sunrise Plumbing', phone: '123', email: 'plumbing@example.com' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('valid Pakistani mobile number');
    expect(prisma.vendor.create).not.toHaveBeenCalled();
  });

  it('keeps the inline combobox create path on the same rule (same endpoint, no second copy)', async () => {
    mockAuth('u-admin', adminMembership);
    mockCreateEcho();

    // Exactly what "Add <typed value> as new vendor" posts on the assignment form.
    const cases: { label: string; payload: Record<string, string>; status: number }[] = [
      { label: 'name + phone', payload: { name: 'Bilal Handyman', phone: '0300 1234567' }, status: 201 },
      { label: 'name + email', payload: { name: 'City Electrician', email: 'city@example.com' }, status: 201 },
      { label: 'name only', payload: { name: 'Some Vendor' }, status: 400 },
    ];

    for (const c of cases) {
      (prisma.vendor.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.vendor.create as ReturnType<typeof vi.fn>).mockClear();

      const res = await request(app)
        .post('/api/v1/vendors')
        .set('x-access-token', adminToken)
        .send(c.payload);

      expect(res.status, c.label).toBe(c.status);
      if (c.status === 201) {
        expect(prisma.vendor.create, c.label).toHaveBeenCalledTimes(1);
      } else {
        expect(res.body.error.message, c.label).toContain('Add at least an email or a phone number');
        expect(prisma.vendor.create, c.label).not.toHaveBeenCalled();
      }
    }
  });

  it('dedupes an email-only vendor on email and never matches on a null phone', async () => {
    mockAuth('u-admin', adminMembership);
    (prisma.vendor.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
      vendorRow({ phone: null })
    );

    const res = await request(app)
      .post('/api/v1/vendors')
      .set('x-access-token', adminToken)
      .send({ name: 'City Electrician', email: 'city@example.com' });

    // Returning the existing row is the point: a null phone must not be used as
    // a lookup key, or every email-only vendor would collide with every other.
    expect(res.status).toBe(200);
    expect(prisma.vendor.create).not.toHaveBeenCalled();
    const where = (prisma.vendor.findFirst as ReturnType<typeof vi.fn>).mock.calls[0][0].where;
    expect(where).toEqual({ societyId: 's1', deletedAt: null, email: 'city@example.com' });
    expect(where.phone).toBeUndefined();
    expect(res.body.data.alreadyExisted).toBe(true);
  });
});

describe('PATCH /api/v1/vendors/:id', () => {
  function mockUpdateEcho() {
    (prisma.vendor.update as ReturnType<typeof vi.fn>).mockImplementation(({ data }) =>
      Promise.resolve(vendorRow({ ...data }))
    );
  }

  it('fills in the email a phone-only vendor was missing', async () => {
    mockAuth('u-admin', adminMembership);
    (prisma.vendor.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
      vendorRow({ phone: '+923001234567', email: null })
    );
    mockUpdateEcho();

    const res = await request(app)
      .patch('/api/v1/vendors/v1')
      .set('x-access-token', adminToken)
      .send({ email: 'plumbing@example.com' });

    expect(res.status).toBe(200);
    expect(prisma.vendor.update).toHaveBeenCalledWith({
      where: { id: 'v1' },
      data: { email: 'plumbing@example.com' },
    });
    expect(res.body.data.email).toBe('plumbing@example.com');
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        societyId: 's1', action: 'VENDOR_UPDATED', entityType: 'vendor', entityId: 'v1',
        // The before/after snapshot is what lets the audit trail show a
        // channel being added for a vendor that previously had none.
        beforeJson: expect.objectContaining({ email: null }),
        afterJson: expect.objectContaining({ email: 'plumbing@example.com' }),
      }),
    }));
  });

  it('allows clearing the phone while an email remains', async () => {
    mockAuth('u-admin', adminMembership);
    (prisma.vendor.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
      vendorRow({ phone: '+923001234567', email: 'plumbing@example.com' })
    );
    mockUpdateEcho();

    const res = await request(app)
      .patch('/api/v1/vendors/v1')
      .set('x-access-token', adminToken)
      .send({ phone: null });

    expect(res.status).toBe(200);
    expect(prisma.vendor.update).toHaveBeenCalledWith({
      where: { id: 'v1' },
      data: { phone: null },
    });
  });

  it('rejects a patch that clears both channels at the schema boundary', async () => {
    mockAuth('u-admin', adminMembership);

    const res = await request(app)
      .patch('/api/v1/vendors/v1')
      .set('x-access-token', adminToken)
      .send({ phone: null, email: null });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Add at least an email or a phone number');
    expect(prisma.vendor.findFirst).not.toHaveBeenCalled();
    expect(prisma.vendor.update).not.toHaveBeenCalled();
  });

  it('rejects clearing the last remaining channel (checked against the merged record)', async () => {
    mockAuth('u-admin', adminMembership);
    (prisma.vendor.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
      vendorRow({ phone: '+923001234567', email: null })
    );

    const res = await request(app)
      .patch('/api/v1/vendors/v1')
      .set('x-access-token', adminToken)
      .send({ phone: null });

    // The patch alone looks fine; merged with the stored row it leaves the
    // vendor unreachable, which is what the route refuses.
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Add at least an email or a phone number');
    expect(res.body.error.message).toContain('no way to contact');
    expect(prisma.vendor.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('is tenant-scoped: another society\'s vendor is a 404 and nothing is written', async () => {
    mockAuth('u-admin', adminMembership);
    (prisma.vendor.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await request(app)
      .patch('/api/v1/vendors/v-other')
      .set('x-access-token', adminToken)
      .send({ email: 'plumbing@example.com' });

    expect(res.status).toBe(404);
    expect((prisma.vendor.findFirst as ReturnType<typeof vi.fn>).mock.calls[0][0].where).toEqual({
      id: 'v-other', societyId: 's1', deletedAt: null,
    });
    expect(prisma.vendor.update).not.toHaveBeenCalled();
  });

  it('forbids residents (403)', async () => {
    mockAuth('u-resident', residentMembership);

    const res = await request(app)
      .patch('/api/v1/vendors/v1')
      .set('x-access-token', residentToken)
      .send({ email: 'plumbing@example.com' });

    expect(res.status).toBe(403);
    expect(prisma.vendor.update).not.toHaveBeenCalled();
  });
});
