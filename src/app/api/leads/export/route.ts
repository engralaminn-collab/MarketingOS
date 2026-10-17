import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { serializeCsvRow } from '@/lib/csv';

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const leads = await db.lead.findMany({
      where: { companyId: payload.companyId },
      orderBy: { createdAt: 'desc' },
      include: { tags: true },
    });

    const header = ['Name', 'Email', 'Phone', 'Company', 'Source', 'Status', 'Score', 'Notes', 'Tags', 'Created At'];
    const lines = [serializeCsvRow(header)];
    for (const lead of leads) {
      lines.push(serializeCsvRow([
        lead.name,
        lead.email,
        lead.phone,
        lead.companyName,
        lead.source,
        lead.status,
        lead.score,
        lead.notes,
        lead.tags.map((tag) => tag.name).join('; '),
        lead.createdAt.toISOString(),
      ]));
    }

    return new NextResponse(`\uFEFF${lines.join('\r\n')}`, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="leads-export-${new Date().toISOString().slice(0, 10)}.csv"`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('[GET /api/leads/export]', error);
    return NextResponse.json({ error: 'Failed to export leads' }, { status: 500 });
  }
}
