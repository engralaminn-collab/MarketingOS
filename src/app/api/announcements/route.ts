import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, ROLE_LABELS } from '@/lib/auth';
import { emitEvent } from '@/lib/events';

// GET /api/announcements — list all active announcements for the company
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const announcements = await db.announcement.findMany({
      where: { companyId: payload.companyId },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });

    // Resolve creator names
    const creatorIds = [...new Set(announcements.map((a) => a.createdBy).filter(Boolean))] as string[];
    let creators: Record<string, { id: string; name: string; email: string }> = {};
    if (creatorIds.length > 0) {
      const creatorUsers = await db.user.findMany({
        where: { id: { in: creatorIds } },
        select: { id: true, name: true, email: true },
      });
      creators = Object.fromEntries(creatorUsers.map((u) => [u.id, u]));
    }

    const data = announcements.map((a) => ({
      id: a.id,
      title: a.title,
      content: a.content,
      priority: a.priority,
      targetRoles: a.targetRoles,
      isActive: a.isActive,
      expiresAt: a.expiresAt?.toISOString() || null,
      createdBy: a.createdBy ? (creators[a.createdBy]?.name || 'Unknown') : 'System',
      creatorId: a.createdBy,
      createdAt: a.createdAt.toISOString(),
    }));

    return NextResponse.json({ data });
  } catch (err) {
    console.error('[GET /api/announcements]', err);
    return NextResponse.json({ error: 'Failed to fetch announcements' }, { status: 500 });
  }
}

// POST /api/announcements — create a new announcement (admins only)
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Only admins+ can post
    const adminRoles = ['super_admin', 'company_owner', 'admin', 'manager'];
    if (!adminRoles.includes(payload.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await req.json();
    const title = String(body.title || '').trim();
    const content = String(body.content || '').trim();
    const priority = ['low', 'normal', 'high'].includes(body.priority) ? body.priority : 'normal';
    const targetRoles = body.targetRoles || 'all';
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    }

    const announcement = await db.announcement.create({
      data: {
        title,
        content,
        priority,
        targetRoles: String(targetRoles),
        isActive: body.isActive !== false,
        expiresAt,
        createdBy: payload.userId,
        companyId: payload.companyId,
      },
    });

    // Determine recipients based on targetRoles
    let recipientUserIds: string[] | undefined;
    if (targetRoles && targetRoles !== 'all') {
      const roles = String(targetRoles).split(',').map((r) => r.trim());
      const members = await db.companyUser.findMany({
        where: { companyId: payload.companyId, role: { in: roles } },
        select: { userId: true },
      });
      recipientUserIds = members.map((m) => m.userId);
    }

    // Fire event: notification + activity + webhook for every recipient
    await emitEvent({
      companyId: payload.companyId,
      userId: payload.userId,
      type: 'announcement.posted',
      title: `📢 ${title}`,
      description: content.slice(0, 200),
      resourceType: 'announcement',
      resourceId: announcement.id,
      link: '/announcements',
      recipientIds: recipientUserIds,
      metadata: { priority, targetRoles, announcementId: announcement.id },
    });

    return NextResponse.json({
      data: {
        id: announcement.id,
        title: announcement.title,
        content: announcement.content,
        priority: announcement.priority,
        targetRoles: announcement.targetRoles,
        isActive: announcement.isActive,
        createdAt: announcement.createdAt.toISOString(),
        createdBy: 'You',
      },
    }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/announcements]', err);
    return NextResponse.json({ error: 'Failed to create announcement' }, { status: 500 });
  }
}
