import Papa from 'papaparse';

/** A CSV data row keyed by header name. */
export type CsvRow = Record<string, string>;

export interface CsvParseIssue {
  message: string;
  /** Zero-based data-row index Papa reported the issue for, when known. */
  row?: number;
  code?: string;
}

export interface ParsedCsv {
  /** Data rows keyed by header. Cells absent from a short row are '' not undefined. */
  rows: CsvRow[];
  /** Header names in file order. */
  headers: string[];
  /** Structural problems only - safe to treat as fatal. */
  errors: CsvParseIssue[];
}

// Excel writes `sep=;` as the first line when the locale uses a non-comma
// delimiter. Papa would otherwise read that line as the header row.
const SEP_HINT = /^sep=(.)\r?\n/i;

// Papa parks cells that overflow the header in this bucket; they are dropped.
const EXTRA_FIELD_KEY = '__parsed_extra';

/**
 * Parse an uploaded CSV into row objects.
 *
 * Two kinds of trouble are deliberately tolerated rather than rejected, because
 * both are common in files people export from a spreadsheet and neither makes
 * the data unusable:
 *
 *  - `FieldMismatch` (a row with fewer or more cells than the header, i.e. a
 *    dropped trailing empty column or a stray comma). Short rows are padded
 *    with '' so they still get a precise per-row validation message, and
 *    overflow cells are ignored.
 *  - `UndetectableDelimiter`, which burns a single-column file (the building
 *    import) even though Papa parsed every row correctly with ','.
 *
 * Anything else - unterminated quotes, a broken escape - is returned in
 * `errors` for the caller to reject.
 */
export function parseCsvBuffer(buffer: Buffer): ParsedCsv {
  let text = buffer.toString('utf-8');
  // Strip the BOM Excel and Google Sheets prepend (as UTF-8 or UTF-16 artefacts).
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  let delimiter: string | undefined;
  const sepMatch = text.match(SEP_HINT);
  if (sepMatch) {
    delimiter = sepMatch[1];
    text = text.slice(sepMatch[0].length);
  }

  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    // 'greedy' also drops rows that are only delimiters (",,,,"), which
    // spreadsheet exports leave behind.
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
    ...(delimiter ? { delimiter } : {}),
  });

  const errors: CsvParseIssue[] = parsed.errors
    .filter((e) => e.type !== 'FieldMismatch' && e.code !== 'UndetectableDelimiter')
    .map((e) => ({ message: e.message, row: e.row, code: e.code }));

  const headers = (parsed.meta.fields ?? []).filter((f) => f !== EXTRA_FIELD_KEY);

  const rows: CsvRow[] = parsed.data.map((raw) => {
    const row: CsvRow = {};
    for (const header of headers) {
      const value = raw[header];
      row[header] = value === undefined || value === null ? '' : String(value);
    }
    return row;
  });

  return { rows, headers, errors };
}

/**
 * Human-readable "which line of the file" for a Papa row index: Papa counts
 * data rows from zero, spreadsheets count all lines from one, and the header
 * takes the first line.
 */
export function csvLineNumber(row: number | undefined): number | undefined {
  return typeof row === 'number' ? row + 2 : undefined;
}
