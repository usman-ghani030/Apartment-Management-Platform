import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import Papa from 'papaparse';
import { CSV_IMPORT_HEADERS, CSV_BUILDING_HEADERS } from '@apartment/shared';

// Hermetic DB: mock prisma so these tests never touch a real database.
vi.mock('../lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    membership: { findMany: vi.fn(), findFirst: vi.fn() },
    unit: { findMany: vi.fn(), create: vi.fn() },
    building: { findMany: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import app from '../app';

const SECRET = process.env.JWT_ACCESS_SECRET || 'dev-fallback-access-secret';
const adminToken = jwt.sign({ userId: 'u-admin' }, SECRET, { expiresIn: '15m' });

const adminMembership = {
  id: 'm-admin', userId: 'u-admin', societyId: 's1', unitId: null,
  role: 'COMMITTEE_ADMIN', status: 'ACTIVE', deletedAt: null,
  society: { name: 'Sunrise Apartments', slug: 'sunrise' },
};

function mockAuth() {
  (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u-admin', email: 'admin@x.com', name: 'Admin' });
  (prisma.membership.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([adminMembership]);
  (prisma.unit.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (prisma.building.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
}

const upload = (csv: string) =>
  request(app)
    .post('/api/v1/import/validate')
    .set('x-access-token', adminToken)
    .attach('file', Buffer.from(csv, 'utf-8'), 'units.csv');

const SAMPLE_ROWS = [
  { 'Building Name': 'Tower A', 'Unit Number': '101', 'Floor': '1', 'Bedroom Type': 'TWO_BED', 'Primary Contact Name': 'John Smith', 'Primary Contact Email': 'john@example.com', 'Primary Contact Phone': '+92 300 1234567' },
  { 'Building Name': 'Tower A', 'Unit Number': '102', 'Floor': '1', 'Bedroom Type': 'ONE_BED', 'Primary Contact Name': '', 'Primary Contact Email': '', 'Primary Contact Phone': '' },
  { 'Building Name': 'Tower B', 'Unit Number': 'A-101', 'Floor': '1', 'Bedroom Type': 'STUDIO', 'Primary Contact Name': '', 'Primary Contact Email': '', 'Primary Contact Phone': '' },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth();
});

afterAll(() => {
  vi.restoreAllMocks();
});

describe('POST /api/v1/import/validate', () => {
  it('accepts the unmodified sample CSV', async () => {
    const csv = Papa.unparse(SAMPLE_ROWS, { columns: CSV_IMPORT_HEADERS as unknown as string[] });

    const res = await upload(csv);

    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data.totalRows).toBe(3);
    expect(res.body.data.toCreate).toHaveLength(3);
    expect(res.body.data.errors).toEqual([]);
  });

  it('imports a file whose last column was dropped, instead of failing on field count', async () => {
    // Regression: this used to return 400
    // "CSV parse error: Too few fields: expected 7 fields but parsed 6 (row 0)".
    const csv = [
      'Building Name,Unit Number,Floor,Bedroom Type,Primary Contact Name,Primary Contact Email,Primary Contact Phone',
      'Tower A,101,1,TWO_BED,John Smith,john@example.com',
      'Tower A,102,1,ONE_BED,,,',
    ].join('\n');

    const res = await upload(csv);

    expect(res.status).toBe(200);
    expect(res.body.data.toCreate).toHaveLength(2);
    expect(res.body.data.errors).toEqual([]);
    expect(res.body.data.toCreate[0]['Unit Number']).toBe('101');
    expect(res.body.data.toCreate[0]['Primary Contact Phone']).toBeUndefined();
    expect(res.body.data.toCreate[0]['Floor']).toBe(1);
  });

  it('handles a BOM, CRLF line endings and a trailing blank line', async () => {
    const csv = Papa.unparse(SAMPLE_ROWS, { columns: CSV_IMPORT_HEADERS as unknown as string[] });

    const res = await upload('\ufeff' + csv.replace(/\n/g, '\r\n') + '\r\n');

    expect(res.status).toBe(200);
    expect(res.body.data.toCreate).toHaveLength(3);
  });

  it('returns a clear message when the header row is wrong', async () => {
    const csv = [
      'Building,Number,Floor,Type,Name,Email,Phone',
      'Tower A,101,1,TWO_BED,John Smith,john@example.com,+92 300 1234567',
    ].join('\n');

    const res = await upload(csv);

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/missing required column/i);
    expect(res.body.error.message).toContain(CSV_IMPORT_HEADERS[0]);
  });

  it('reports a bad row as a row error while still creating the good ones', async () => {
    const csv = [
      'Building Name,Unit Number,Floor,Bedroom Type,Primary Contact Name,Primary Contact Email,Primary Contact Phone',
      'Tower A,101,1,TWO_BED,John Smith,john@example.com,+92 300 1234567',
      'Tower A,102,1,PENTHOUSE,,,',
    ].join('\n');

    const res = await upload(csv);

    expect(res.status).toBe(200);
    expect(res.body.data.toCreate).toHaveLength(1);
    expect(res.body.data.errors).toHaveLength(1);
    expect(res.body.data.errors[0].row).toBe(3); // second data row, spreadsheet line 3
    expect(res.body.data.errors[0].reason).toContain('Bedroom Type');
  });

  it('skips units that already exist in the society', async () => {
    (prisma.building.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: 'b1', name: 'Tower A' }]);
    (prisma.unit.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { unitNumber: '101', building: { name: 'Tower A' } },
    ]);

    const csv = Papa.unparse(SAMPLE_ROWS, { columns: CSV_IMPORT_HEADERS as unknown as string[] });
    const res = await upload(csv);

    expect(res.status).toBe(200);
    expect(res.body.data.toSkip).toHaveLength(1);
    expect(res.body.data.toSkip[0].unitNumber).toBe('101');
    expect(res.body.data.toCreate).toHaveLength(2);
  });

  it('rejects an empty file and a file with only a header', async () => {
    const empty = await upload('');
    expect(empty.status).toBe(400);
    expect(empty.body.error.message).toContain('empty');

    const headerOnly = await upload(CSV_IMPORT_HEADERS.join(','));
    expect(headerOnly.status).toBe(400);
    expect(headerOnly.body.error.message).toContain('empty');
  });
});

describe('POST /api/v1/import/buildings/validate', () => {
  it('accepts the single-column sample file', async () => {
    const csv = Papa.unparse(
      [{ 'Building Name': 'Tower A' }, { 'Building Name': 'Tower B' }],
      { columns: CSV_BUILDING_HEADERS as unknown as string[] }
    );

    const res = await request(app)
      .post('/api/v1/import/buildings/validate')
      .set('x-access-token', adminToken)
      .attach('file', Buffer.from(csv, 'utf-8'), 'buildings.csv');

    expect(res.status).toBe(200);
    expect(res.body.data.toCreate).toHaveLength(2);
    expect(res.body.data.errors).toEqual([]);
  });
});
