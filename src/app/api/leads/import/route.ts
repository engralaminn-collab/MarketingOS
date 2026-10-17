import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { emitEvent } from '@/lib/events';
import { MAX_CSV_BYTES, parseCsv, sanitizeImportedCsvValue } from '@/lib/csv';

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const contentLength = Number(req.headers.get('content-length') || 0);
    if (contentLength > MAX_CSV_BYTES + 16 * 1024) {
      return NextResponse.json({ error: 'CSV upload exceeds the 5 MB limit' }, { status: 413 });
    }

    let csvText: string;
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file');
      if (!(file instanceof File)) return NextResponse.json({ error: 'CSV file is required' }, { status: 400 });
      if (file.size > MAX_CSV_BYTES) return NextResponse.json({ error: 'CSV upload exceeds the 5 MB limit' }, { status: 413 });
      csvText = await file.text();
    } else if (contentType.includes('application/json')) {
      const rawBody = await req.text();
      if (Buffer.byteLength(rawBody, 'utf8') > MAX_CSV_BYTES + 16 * 1024) {
        return NextResponse.json({ error: 'CSV upload exceeds the 5 MB limit' }, { status: 413 });
      }
      let body: { csv?: unknown };
      try {
        body = JSON.parse(rawBody);
      } catch {
        return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
      }
      csvText = typeof body.csv === 'string' ? body.csv : '';
    } else {
      return NextResponse.json({ error: 'Upload CSV as multipart/form-data or JSON' }, { status: 415 });
    }

    if (!csvText.trim()) return NextResponse.json({ error: 'CSV content is empty' }, { status: 400 });

    let parsed: string[][];
    try {
      parsed = parseCsv(csvText.replace(/^\uFEFF/, ''));
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Malformed CSV' }, { status: 400 });
    }
    if (parsed.length < 2) return NextResponse.json({ error: 'CSV must include a header and at least one data row' }, { status: 400 });

    const header = parsed[0].map((value) => value.toLowerCase().trim());
    const findColumn = (names: string[]) => header.findIndex((value) => names.some((name) => value === name || value.startsWith(`${name} `)));
    const nameIndex = findColumn(['name', 'full name', 'lead name']);
    const emailIndex = findColumn(['email', 'email address']);
    const phoneIndex = findColumn(['phone', 'phone number']);
    const companyIndex = findColumn(['company', 'company name', 'organization']);
    const sourceIndex = findColumn(['source', 'lead source']);
    const statusIndex = findColumn(['status', 'lead status']);
    const scoreIndex = findColumn(['score', 'lead score']);
    const notesIndex = findColumn(['notes', 'comment', 'description']);

    if (nameIndex === -1) return NextResponse.json({ error: 'CSV must have a "Name" column' }, { status: 400 });

    const validStatuses = new Set(['new', 'contacted', 'qualified', 'unqualified', 'lost']);
    const validSources = new Set(['Website', 'Referral', 'LinkedIn', 'Conference', 'Cold Email', 'Webinar', 'Partner']);
    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let rowIndex = 1; rowIndex < parsed.length; rowIndex++) {
      const row = parsed[rowIndex];
      if (!row || row.every((cell) => !cell.trim())) continue;
      const value = (index: number) => index >= 0 ? sanitizeImportedCsvValue((row[index] || '').trim()) : '';
      const name = value(nameIndex);
      const email = value(emailIndex);
      const phone = value(phoneIndex);
      const company = value(companyIndex);
      const notes = value(notesIndex);
      if (!name || name.length > 160 || email.length > 254 || phone.length > 80 || company.length > 160 || (notes?.length || 0) > 5000) {
        skipped++;
        errors.push(`Row ${rowIndex + 1}: invalid or overlong field`);
        continue;
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        skipped++;
        errors.push(`Row ${rowIndex + 1}: invalid email`);
        continue;
      }

      const rawSource = value(sourceIndex);
      const rawStatus = value(statusIndex).toLowerCase();
      const source = validSources.has(rawSource) ? rawSource : 'Website';
      const status = validStatuses.has(rawStatus) ? rawStatus : 'new';
      const parsedScore = Number.parseInt(value(scoreIndex), 10);
      const score = Number.isInteger(parsedScore) && parsedScore >= 0 && parsedScore <= 100 ? parsedScore : 50;

      try {
        await db.$transaction(async (tx) => {
          const lead = await tx.lead.create({
            data: {
              name,
              email: email || null,
              phone: phone || null,
              companyName: company || null,
              source,
              status,
              score,
              notes: notes || null,
              companyId: payload.companyId,
            },
          });
          await tx.leadActivity.create({
            data: { type: 'created', content: 'Imported via CSV', leadId: lead.id },
          });
        });
        created++;
      } catch (error) {
        console.error(`[POST /api/leads/import] failed importing row ${rowIndex + 1}:`, error);
        skipped++;
        errors.push(`Row ${rowIndex + 1}: could not be imported`);
      }
    }

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

    return NextResponse.json({ data: { created, skipped, errors: errors.slice(0, 10) } });
  } catch (error) {
    console.error('[POST /api/leads/import]', error);
    return NextResponse.json({ error: 'Failed to import leads' }, { status: 500 });
  }
}
