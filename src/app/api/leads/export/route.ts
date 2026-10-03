import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { emitEvent } from '@/lib/events';

// GET /api/leads/export — download all leads as CSV
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const leads = await db.lead.findMany({
      where: { companyId: payload.companyId },
      orderBy: { createdAt: 'desc' },
      include: { tags: true },
    });

    const headers = ['Name', 'Email', 'Phone', 'Company', 'Source', 'Status', 'Score', 'Notes', 'Tags', 'Created At'];
    const escape = (val: any) => {
      if (val === null || val === undefined) return '';
      const s = String(val);
      // CSV escape: wrap in quotes if contains comma, quote, or newline
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const rows = leads.map((l) =>
      [
        escape(l.name),
        escape(l.email),
        escape(l.phone),
        escape(l.companyName),
        escape(l.source),
        escape(l.status),
        escape(l.score),
        escape(l.notes),
        escape(l.tags.map((t) => t.name).join('; ')),
        escape(l.createdAt.toISOString()),
      ].join(','),
    );

    const csv = [headers.join(','), ...rows].join('\n');

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="leads-export-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (err) {
    console.error('[GET /api/leads/export]', err);
    return NextResponse.json({ error: 'Failed to export leads' }, { status: 500 });
  }
}
