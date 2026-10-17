export const MAX_CSV_BYTES = 5 * 1024 * 1024;
export const MAX_CSV_ROWS = 5_001; // includes the header row
export const MAX_CSV_COLUMNS = 100;

/** Quote a cell and neutralize formula-leading values for spreadsheet software. */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  let text = String(value).replace(/\0/g, '');
  if (/^[\s\uFEFF\u200B]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function serializeCsvRow(values: readonly unknown[]): string {
  return values.map(escapeCsvCell).join(',');
}

/**
 * Prevent formula-like strings from being stored as executable cells when an
 * exported CSV is opened in Excel, LibreOffice, or similar spreadsheet tools.
 */
export function sanitizeImportedCsvValue(value: string): string {
  const withoutNul = value.replace(/\0/g, '');
  return /^[\s\uFEFF\u200B]*[=+\-@]/.test(withoutNul) ? `'${withoutNul}` : withoutNul;
}

/** Parse RFC-4180-style CSV with strict quote handling and bounded work. */
export function parseCsv(text: string): string[][] {
  if (Buffer.byteLength(text, 'utf8') > MAX_CSV_BYTES) {
    throw new Error(`CSV exceeds the ${MAX_CSV_BYTES}-byte upload limit`);
  }

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let afterQuote = false;

  const pushCell = () => {
    row.push(cell);
    if (row.length > MAX_CSV_COLUMNS) throw new Error(`CSV may contain at most ${MAX_CSV_COLUMNS} columns`);
    cell = '';
    afterQuote = false;
  };
  const pushRow = () => {
    pushCell();
    rows.push(row);
    if (rows.length > MAX_CSV_ROWS) throw new Error(`CSV may contain at most ${MAX_CSV_ROWS - 1} data rows`);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
          afterQuote = true;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (afterQuote) {
      if (ch === ',') {
        pushCell();
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        pushRow();
      } else {
        throw new Error('Malformed CSV: unexpected character after a quoted field');
      }
      continue;
    }

    if (ch === '"') {
      if (cell.length !== 0) throw new Error('Malformed CSV: quote inside an unquoted field');
      inQuotes = true;
    } else if (ch === ',') {
      pushCell();
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      pushRow();
    } else {
      cell += ch;
    }
  }

  if (inQuotes) throw new Error('Malformed CSV: unterminated quoted field');
  if (cell.length > 0 || row.length > 0 || afterQuote) pushRow();
  return rows;
}
