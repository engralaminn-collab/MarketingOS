import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { emitEvent } from '@/lib/events';

// POST /api/leads/import — bulk import leads from CSV text
// Body: { csv: "Name,Email,Phone,Company,Source\n..." }
// OR multipart/form-data with file=leads.csv
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    let csvText = '';
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
      csvText = await file.text();
    } else {
      const body = await req.json();
      csvText = String(body.csv || '');
    }

    if (!csvText.trim()) {
      return NextResponse.json({ error: 'CSV content is empty' }, { status: 400 });
    }

    // Parse CSV — supports quoted fields and escaped quotes ("")
    const parsed = parseCsv(csvText);
    if (parsed.length === 0) {
      return NextResponse.json({ error: 'No rows found in CSV' }, { status: 400 });
    }

    const header = parsed[0].map((h) => h.toLowerCase().trim());
    const findCol = (names: string[]) =>
      header.findIndex((h) => names.some((n) => h === n || h.startsWith(n)));

    const nameIdx = findCol(['name', 'full name', 'lead name']);
    const emailIdx = findCol(['email', 'email address']);
    const phoneIdx = findCol(['phone', 'phone number']);
    const companyIdx = findCol(['company', 'company name', 'organization']);
    const sourceIdx = findCol(['source', 'lead source']);
    const statusIdx = findCol(['status', 'lead status']);
    const scoreIdx = findCol(['score', 'lead score']);
    const notesIdx = findCol(['notes', 'comment', 'description']);

    if (nameIdx === -1) {
      return NextResponse.json(
        { error: 'CSV must have a "Name" column (case-insensitive)' },
        { status: 400 },
      );
    }

    const validStatuses = ['new', 'contacted', 'qualified', 'unqualified', 'lost'];
    const validSources = ['Website', 'Referral', 'LinkedIn', 'Conference', 'Cold Email', 'Webinar', 'Partner'];

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 1; i < parsed.length; i++) {
      const row = parsed[i];
      if (!row || row.length === 0) continue;
      const name = (row[nameIdx] || '').trim();
      if (!name) {
        skipped++;
        errors.push(`Row ${i + 1}: empty name, skipped`);
        continue;
      }

      const email = emailIdx >= 0 ? (row[emailIdx] || '').trim() : '';
      const phone = phoneIdx >= 0 ? (row[phoneIdx] || '').trim() : '';
      const company = companyIdx >= 0 ? (row[companyIdx] || '').trim() : '';
      let source = sourceIdx >= 0 ? (row[sourceIdx] || '').trim() : 'Website';
      let status = statusIdx >= 0 ? (row[statusIdx] || '').trim().toLowerCase() : 'new';
      if (!validSources.includes(source)) source = 'Website';
      if (!validStatuses.includes(status)) status = 'new';

      let score = 50;
      if (scoreIdx >= 0) {
        const parsed = parseInt(row[scoreIdx] || '50', 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) score = parsed;
      }

      const notes = notesIdx >= 0 ? (row[notesIdx] || '').trim() : null;

      try {
        const lead = await db.lead.create({
          data: {
            name,
            email: email || null,
            phone: phone || null,
            companyName: company || null,
            source,
            status,
            score,
            notes,
            companyId: payload.companyId,
          },
        });

        await db.leadActivity.create({
          data: { type: 'created', content: 'Imported via CSV', leadId: lead.id },
        });

        created++;
      } catch (err) {
        skipped++;
        errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : 'failed'}`);
      }
    }

    // Fire single event for the bulk import
    await emitEvent({
      companyId: payload.companyId,
      userId: payload.userId,
      type: 'lead.bulk_imported',
      title: 'Leads imported via CSV',
      description: `${created} leads imported (${skipped} skipped)`,
      resourceType: 'lead',
      link: '/crm',
      metadata: { created, skipped, total: parsed.length - 1 },
    });

    return NextResponse.json({
      data: { created, skipped, errors: errors.slice(0, 10) },
    });
  } catch (err) {
    console.error('[POST /api/leads/import]', err);
    return NextResponse.json({ error: 'Failed to import leads' }, { status: 500 });
  }
}

/**
 * Minimal RFC-4180-compliant CSV parser.
 * Handles quoted fields with embedded commas, quotes (""), and newlines.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(cell);
        cell = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      } else {
        cell += ch;
      }
    }
  }
  // Last cell + last row
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}
