import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hasPermission, verifyToken } from '@/lib/auth';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    if (!hasPermission(payload.role, 'admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const existing = await db.apiKey.findFirst({ where: { id, companyId: payload.companyId } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await db.apiKey.delete({ where: { id } });
    await db.auditLog.create({
      data: {
        action: 'api_key.revoke',
        resource: `API key: ${existing.name}`,
        details: 'Revoked API key',
        userId: payload.userId,
        companyId: payload.companyId,
      },
    }).catch((error) => console.error('[DELETE /api/settings/api-keys/[id]] audit log failed:', error));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/settings/api-keys/[id]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
