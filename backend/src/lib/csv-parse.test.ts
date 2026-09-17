import { describe, it, expect } from 'vitest';
import Papa from 'papaparse';
import { CSVUnitRowSchema, CSV_IMPORT_HEADERS, CSV_BUILDING_HEADERS } from '@apartment/shared';
import { parseCsvBuffer, csvLineNumber } from './csv-parse';

// The exact file the "Download sample CSV" button hands out.
const SAMPLE_ROWS = [
  { 'Building Name': 'Tower A', 'Unit Number': '101', 'Floor': '1', 'Bedroom Type': 'TWO_BED', 'Primary Contact Name': 'John Smith', 'Primary Contact Email': 'john@example.com', 'Primary Contact Phone': '+92 300 1234567' },
  { 'Building Name': 'Tower A', 'Unit Number': '102', 'Floor': '1', 'Bedroom Type': 'ONE_BED', 'Primary Contact Name': '', 'Primary Contact Email': '', 'Primary Contact Phone': '' },
  { 'Building Name': 'Tower B', 'Unit Number': 'A-101', 'Floor': '1', 'Bedroom Type': 'STUDIO', 'Primary Contact Name': '', 'Primary Contact Email': '', 'Primary Contact Phone': '' },
];

const file = (text: string) => Buffer.from(text, 'utf-8');

describe('parseCsvBuffer', () => {
  it('parses the sample units CSV without errors', () => {
    const csv = Papa.unparse(SAMPLE_ROWS, { columns: CSV_IMPORT_HEADERS as unknown as string[] });
    const { rows, headers, errors } = parseCsvBuffer(file(csv));

    expect(errors).toEqual([]);
    expect(headers).toEqual([...CSV_IMPORT_HEADERS]);
    expect(rows).toHaveLength(3);
    expect(rows[0]['Unit Number']).toBe('101');
    expect(rows[0]['Primary Contact Phone']).toBe('+92 300 1234567');
  });

  it('pads a row that is missing trailing empty columns instead of failing the file', () => {
    // This is the bug: a 6-cell row against a 7-cell header used to abort the
    // whole upload with "Too few fields: expected 7 fields but parsed 6".
    const csv = [
      'Building Name,Unit Number,Floor,Bedroom Type,Primary Contact Name,Primary Contact Email,Primary Contact Phone',
      'Tower A,101,1,TWO_BED,John Smith,john@example.com',
      'Tower A,102,1,ONE_BED,,,',
    ].join('\n');

    const { rows, errors } = parseCsvBuffer(file(csv));

    expect(errors).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0]['Primary Contact Phone']).toBe('');
    expect(rows[1]['Primary Contact Phone']).toBe('');
  });

  it('keeps a short row valid when the dropped column was optional', () => {
    const csv = [
      'Building Name,Unit Number,Floor,Bedroom Type,Primary Contact Name,Primary Contact Email,Primary Contact Phone',
      'Tower A,101,1,TWO_BED',
    ].join('\n');

    const { rows, errors } = parseCsvBuffer(file(csv));

    expect(errors).toEqual([]);
    const parsed = CSVUnitRowSchema.safeParse(rows[0]);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data['Primary Contact Name']).toBeUndefined();
      expect(parsed.data['Floor']).toBe(1);
    }
  });

  it('reports the short row as a row error, not a file error, when a required column is missing', () => {
    const csv = [
      'Building Name,Unit Number,Floor,Bedroom Type,Primary Contact Name,Primary Contact Email,Primary Contact Phone',
      'Tower A,101,1',
    ].join('\n');

    const { rows, errors } = parseCsvBuffer(file(csv));

    // The file parses; only the row fails, with a message the user can act on.
    expect(errors).toEqual([]);
    expect(rows[0]['Bedroom Type']).toBe('');

    const parsed = CSVUnitRowSchema.safeParse(rows[0]);
    expect(parsed.success).toBe(false);
  });

  it('tolerates a stray extra column', () => {
    const csv = [
      'Building Name,Unit Number,Floor,Bedroom Type,Primary Contact Name,Primary Contact Email,Primary Contact Phone',
      'Tower A,101,1,TWO_BED,John Smith,john@example.com,+92 300 1234567,surplus',
    ].join('\n');

    const { rows, errors } = parseCsvBuffer(file(csv));

    expect(errors).toEqual([]);
    expect(rows[0]).not.toHaveProperty('__parsed_extra');
    expect(Object.keys(rows[0])).toEqual([...CSV_IMPORT_HEADERS]);
  });

  it('handles a BOM and CRLF line endings', () => {
    const csv = Papa.unparse(SAMPLE_ROWS, { columns: CSV_IMPORT_HEADERS as unknown as string[] });

    for (const text of ['\ufeff' + csv, csv.replace(/\n/g, '\r\n'), '\ufeff' + csv.replace(/\n/g, '\r\n')]) {
      const { rows, headers, errors } = parseCsvBuffer(file(text));
      expect(errors).toEqual([]);
      expect(headers[0]).toBe('Building Name');
      expect(rows).toHaveLength(3);
    }
  });

  it('skips blank lines and lines made only of delimiters', () => {
    const csv = [
      'Building Name,Unit Number,Floor,Bedroom Type,Primary Contact Name,Primary Contact Email,Primary Contact Phone',
      'Tower A,101,1,TWO_BED,John Smith,john@example.com,+92 300 1234567',
      '',
      ',,,,,,',
      '',
      'Tower A,102,1,ONE_BED,,,',
      '',
    ].join('\n');

    const { rows, errors } = parseCsvBuffer(file(csv));

    expect(errors).toEqual([]);
    expect(rows).toHaveLength(2);
  });

  it('honours the Excel `sep=;` hint', () => {
    const csv = [
      'sep=;',
      'Building Name;Unit Number;Floor;Bedroom Type;Primary Contact Name;Primary Contact Email;Primary Contact Phone',
      'Tower A;101;1;TWO_BED;John Smith;john@example.com;+92 300 1234567',
    ].join('\r\n');

    const { rows, headers, errors } = parseCsvBuffer(file(csv));

    expect(errors).toEqual([]);
    expect(headers).toEqual([...CSV_IMPORT_HEADERS]);
    expect(rows[0]['Building Name']).toBe('Tower A');
  });

  it('parses the single-column buildings file without complaining about the delimiter', () => {
    const csv = Papa.unparse(
      [{ 'Building Name': 'Tower A' }, { 'Building Name': 'Tower B' }],
      { columns: CSV_BUILDING_HEADERS as unknown as string[] }
    );

    const { rows, headers, errors } = parseCsvBuffer(file(csv));

    expect(errors).toEqual([]);
    expect(headers).toEqual(['Building Name']);
    expect(rows.map((r) => r['Building Name'])).toEqual(['Tower A', 'Tower B']);
  });

  it('reads quoted values containing commas and newlines', () => {
    const csv = [
      'Building Name,Unit Number,Floor,Bedroom Type,Primary Contact Name,Primary Contact Email,Primary Contact Phone',
      '"Tower A, Phase 2",101,1,TWO_BED,"Smith, John",john@example.com,+92 300 1234567',
    ].join('\n');

    const { rows, errors } = parseCsvBuffer(file(csv));

    expect(errors).toEqual([]);
    expect(rows[0]['Building Name']).toBe('Tower A, Phase 2');
    expect(rows[0]['Primary Contact Name']).toBe('Smith, John');
  });

  it('still rejects a genuinely broken file', () => {
    const csv = [
      'Building Name,Unit Number,Floor,Bedroom Type,Primary Contact Name,Primary Contact Email,Primary Contact Phone',
      '"Tower A,101,1,TWO_BED,John Smith,john@example.com,+92 300 1234567',
    ].join('\n');

    const { errors } = parseCsvBuffer(file(csv));

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toMatch(/unterminated/i);
    expect(csvLineNumber(errors[0].row)).toBeGreaterThanOrEqual(2);
  });

  it('returns no rows for an empty file', () => {
    const { rows, errors } = parseCsvBuffer(file(''));
    expect(rows).toEqual([]);
    expect(errors).toEqual([]);
  });
});

describe('csvLineNumber', () => {
  it('maps a zero-based Papa row index to the line a spreadsheet shows', () => {
    expect(csvLineNumber(0)).toBe(2); // first data row sits under the header
    expect(csvLineNumber(4)).toBe(6);
  });

  it('is undefined when Papa does not report a row', () => {
    expect(csvLineNumber(undefined)).toBeUndefined();
  });
});
