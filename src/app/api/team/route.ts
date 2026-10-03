import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, ROLE_LABELS } from '@/lib/auth';

// GET /api/team — returns real members, pending invitations, and audit logs
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const companyId = payload.companyId;

    const [members, invitations, auditLogs] = await Promise.all([
      db.companyUser.findMany({
        where: { companyId },
        include: { user: true },
        orderBy: { joinedAt: 'desc' },
      }),
      db.invitation.findMany({
        where: { companyId, acceptedAt: null },
        orderBy: { createdAt: 'desc' },
      }),
      db.auditLog.findMany({
        where: { companyId },
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    // Transform to the shape the frontend expects
    const transformedMembers = members.map((m) => ({
      id: m.id,
      userId: m.user.id,  // expose the actual User.id for messaging
      name: m.user.name,
      email: m.user.email,
      role: ROLE_LABELS[m.role] || m.role,
      roleKey: m.role,
      joinDate: m.joinedAt.toISOString(),
      status: m.user.isActive ? 'active' : 'inactive',
      avatar: m.user.avatar,
      lastLoginAt: m.user.lastLoginAt?.toISOString() || null,
    }));

    const pendingInvitations = invitations.map((inv) => {
      const isExpired = inv.expiresAt < new Date();
      return {
        id: inv.id,
        email: inv.email,
        role: ROLE_LABELS[inv.role] || inv.role,
        roleKey: inv.role,
        invitedBy: 'System',
        expiry: inv.expiresAt.toISOString(),
        status: isExpired ? 'expired' : 'pending',
      };
    });

    const transformedLogs = auditLogs.map((log) => ({
      id: log.id,
      timestamp: log.createdAt.toISOString(),
      user: log.user?.name || 'System',
      action: prettyAction(log.action),
      resource: log.resource,
      details: log.details || '',
    }));

    return NextResponse.json({
      members: transformedMembers,
      pendingInvitations,
      auditLogs: transformedLogs,
      roles: ROLE_LABELS,
    });
  } catch (err) {
    console.error('[GET /api/team]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/team — multi-action endpoint
// Body: { action: 'invite' | 'update_role' | 'remove_member' | 'resend_invitation' | 'revoke_invitation', ... }
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const companyId = payload.companyId;
    const body = await req.json();
    const action = body.action;

    if (action === 'invite') {
      const { email, role } = body;
      if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });
      const inviteToken = crypto.randomUUID().replace(/-/g, '');
      const invitation = await db.invitation.create({
        data: {
          email: String(email),
          role: role || 'team_member',
          token: inviteToken,
          expiresAt: new Date(Date.now() + 7 * 86400000),
          companyId,
        },
      });
      await db.auditLog.create({
        data: {
          action: 'invite',
          resource: `Invitation: ${email}`,
          details: `Invited as ${ROLE_LABELS[role] || role}`,
          userId: payload.userId,
          companyId,
        },
      });
      return NextResponse.json({ invitation });
    }

    if (action === 'update_role') {
      const { companyUserId, role } = body;
      if (!companyUserId || !role) return NextResponse.json({ error: 'companyUserId and role are required' }, { status: 400 });
      const target = await db.companyUser.findFirst({ where: { id: companyUserId, companyId } });
      if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
      const updated = await db.companyUser.update({
        where: { id: companyUserId },
        data: { role },
      });
      await db.auditLog.create({
        data: {
          action: 'update_role',
          resource: `Member: ${companyUserId}`,
          details: `Role changed to ${ROLE_LABELS[role] || role}`,
          userId: payload.userId,
          companyId,
        },
      });
      return NextResponse.json({ updated });
    }

    if (action === 'remove_member') {
      const { companyUserId } = body;
      if (!companyUserId) return NextResponse.json({ error: 'companyUserId is required' }, { status: 400 });
      const target = await db.companyUser.findFirst({ where: { id: companyUserId, companyId } });
      if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
      // Unlink assigned leads/tickets first
      await db.lead.updateMany({ where: { assignedToId: companyUserId }, data: { assignedToId: null } });
      await db.ticket.updateMany({ where: { assignedToId: companyUserId }, data: { assignedToId: null } });
      await db.companyUser.delete({ where: { id: companyUserId } });
      await db.auditLog.create({
        data: {
          action: 'remove_member',
          resource: `Member: ${companyUserId}`,
          details: 'Removed from company',
          userId: payload.userId,
          companyId,
        },
      });
      return NextResponse.json({ success: true });
    }

    if (action === 'resend_invitation') {
      const { invitationId } = body;
      if (!invitationId) return NextResponse.json({ error: 'invitationId is required' }, { status: 400 });
      const inv = await db.invitation.findFirst({ where: { id: invitationId, companyId } });
      if (!inv) return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
      await db.invitation.update({
        where: { id: invitationId },
        data: { expiresAt: new Date(Date.now() + 7 * 86400000) },
      });
      return NextResponse.json({ success: true });
    }

    if (action === 'revoke_invitation') {
      const { invitationId } = body;
      if (!invitationId) return NextResponse.json({ error: 'invitationId is required' }, { status: 400 });
      const inv = await db.invitation.findFirst({ where: { id: invitationId, companyId } });
      if (!inv) return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
      await db.invitation.delete({ where: { id: invitationId } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    console.error('[POST /api/team]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function prettyAction(action: string): string {
  const map: Record<string, string> = {
    invite: 'Invited Member',
    update_role: 'Updated Role',
    remove_member: 'Removed Member',
    create: 'Created',
    update: 'Updated',
    delete: 'Deleted',
    login: 'Logged In',
    logout: 'Logged Out',
  };
  return map[action] || action.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
