import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hasPermission, verifyToken } from '@/lib/auth';
import { emitEvent } from '@/lib/events';

// PATCH /api/announcements/[id] — update announcement
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    if (!hasPermission(payload.role, 'admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const existing = await db.announcement.findFirst({
      where: { id, companyId: payload.companyId },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await req.json();
    const update: any = {};
    if (body.title !== undefined) update.title = String(body.title).trim();
    if (body.content !== undefined) update.content = String(body.content).trim();
    if (['low', 'normal', 'high'].includes(body.priority)) update.priority = body.priority;
    if (body.targetRoles !== undefined) update.targetRoles = String(body.targetRoles);
    if (body.isActive !== undefined) update.isActive = !!body.isActive;
    if (body.expiresAt !== undefined) update.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

    const announcement = await db.announcement.update({ where: { id }, data: update });

    await emitEvent({
      companyId: payload.companyId,
      userId: payload.userId,
      type: 'announcement.updated',
      title: 'Announcement updated',
      description: `Announcement "${announcement.title}" was updated`,
      resourceType: 'announcement',
      resourceId: id,
      link: '/announcements',
      metadata: { changes: Object.keys(update) },
    });

    return NextResponse.json({ data: announcement });
  } catch (err) {
    console.error('[PATCH /api/announcements/[id]]', err);
    return NextResponse.json({ error: 'Failed to update announcement' }, { status: 500 });
  }
}

// DELETE /api/announcements/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    if (!hasPermission(payload.role, 'admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const existing = await db.announcement.findFirst({
      where: { id, companyId: payload.companyId },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await db.announcement.delete({ where: { id } });

    await emitEvent({
      companyId: payload.companyId,
      userId: payload.userId,
      type: 'announcement.deleted',
      title: 'Announcement deleted',
      description: `Announcement "${existing.title}" was deleted`,
      resourceType: 'announcement',
      resourceId: id,
    });

    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    console.error('[DELETE /api/announcements/[id]]', err);
    return NextResponse.json({ error: 'Failed to delete announcement' }, { status: 500 });
  }
}
