import { createHash, randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hasPermission, ROLE_LABELS, ROLES, verifyToken } from '@/lib/auth';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITABLE_ROLES = ROLES.filter((role) => role !== 'super_admin' && role !== 'company_owner');

function roleKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (INVITABLE_ROLES.includes(normalized as (typeof INVITABLE_ROLES)[number])) return normalized;
  const labelMatch = Object.entries(ROLE_LABELS).find(([, label]) => label.toLowerCase() === value.trim().toLowerCase());
  return labelMatch && INVITABLE_ROLES.includes(labelMatch[0] as (typeof INVITABLE_ROLES)[number]) ? labelMatch[0] : null;
}

function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function createInvitationToken(): string {
  return randomBytes(32).toString('base64url');
}

function inviteLink(token: string): string {
  return `/invite?token=${encodeURIComponent(token)}`;
}

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    if (!hasPermission(payload.role, 'manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

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

    return NextResponse.json({
      members: members.map((member) => ({
        id: member.id,
        userId: member.user.id,
        name: member.user.name,
        email: member.user.email,
        role: ROLE_LABELS[member.role] || member.role,
        roleKey: member.role,
        joinDate: member.joinedAt.toISOString(),
        status: member.user.isActive ? 'active' : 'inactive',
        avatar: member.user.avatar,
        lastLoginAt: member.user.lastLoginAt?.toISOString() || null,
      })),
      pendingInvitations: invitations.map((invitation) => ({
        id: invitation.id,
        email: invitation.email,
        role: ROLE_LABELS[invitation.role] || invitation.role,
        roleKey: invitation.role,
        invitedBy: 'Workspace admin',
        expiry: invitation.expiresAt.toISOString(),
        status: invitation.expiresAt < new Date() ? 'expired' : 'pending',
      })),
      auditLogs: auditLogs.map((log) => ({
        id: log.id,
        timestamp: log.createdAt.toISOString(),
        user: log.user?.name || 'System',
        action: prettyAction(log.action),
        resource: log.resource,
        details: log.details || '',
      })),
      roles: Object.fromEntries(INVITABLE_ROLES.map((role) => [role, ROLE_LABELS[role] || role])),
    });
  } catch (error) {
    console.error('[GET /api/team]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    if (!hasPermission(payload.role, 'admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const companyId = payload.companyId;
    const body = await req.json();
    const action = typeof body?.action === 'string' ? body.action : '';

    if (action === 'invite') {
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const role = roleKey(body.role || 'team_member');
      if (!email || !EMAIL_PATTERN.test(email) || email.length > 254) {
        return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 });
      }
      if (!role) return NextResponse.json({ error: 'Unsupported team role' }, { status: 400 });

      const [existingMember, pendingInvitation] = await Promise.all([
        db.companyUser.findFirst({ where: { companyId, user: { email } }, select: { id: true } }),
        db.invitation.findFirst({ where: { companyId, email, acceptedAt: null }, select: { id: true } }),
      ]);
      if (existingMember) return NextResponse.json({ error: 'This person is already a member' }, { status: 409 });
      if (pendingInvitation) return NextResponse.json({ error: 'An invitation is already pending for this email' }, { status: 409 });

      const rawToken = createInvitationToken();
      const invitation = await db.invitation.create({
        data: {
          email,
          role,
          token: hashInvitationToken(rawToken),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60_000),
          companyId,
        },
        select: { id: true, email: true, role: true, expiresAt: true },
      });
      await db.auditLog.create({
        data: {
          action: 'invite',
          resource: `Invitation: ${email}`,
          details: `Created a ${ROLE_LABELS[role] || role} invitation`,
          userId: payload.userId,
          companyId,
        },
      });
      return NextResponse.json({
        invitation: {
          ...invitation,
          roleKey: invitation.role,
          role: ROLE_LABELS[invitation.role] || invitation.role,
          expiresAt: invitation.expiresAt.toISOString(),
          inviteUrl: inviteLink(rawToken),
        },
      }, { status: 201 });
    }

    if (action === 'update_role') {
      const { companyUserId } = body;
      const newRole = roleKey(body.role);
      if (!companyUserId || !newRole) {
        return NextResponse.json({ error: 'A valid member ID and role are required' }, { status: 400 });
      }
      if (newRole === 'company_owner' || newRole === 'super_admin') {
        return NextResponse.json({ error: 'Owner and super-admin roles cannot be assigned here' }, { status: 403 });
      }

      const target = await db.companyUser.findFirst({
        where: { id: companyUserId, companyId },
        include: { user: { select: { id: true } } },
      });
      if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
      if (target.user.id === payload.userId || ['company_owner', 'super_admin'].includes(target.role)) {
        return NextResponse.json({ error: 'This member role cannot be changed here' }, { status: 403 });
      }
      if (!hasPermission(payload.role, 'company_owner') && target.role === 'admin') {
        return NextResponse.json({ error: 'Only an owner can change another admin role' }, { status: 403 });
      }

      const updated = await db.companyUser.update({ where: { id: target.id }, data: { role: newRole } });
      await db.auditLog.create({
        data: {
          action: 'update_role',
          resource: `Member: ${target.id}`,
          details: `Role changed to ${ROLE_LABELS[newRole] || newRole}`,
          userId: payload.userId,
          companyId,
        },
      });
      return NextResponse.json({ updated: { id: updated.id, role: updated.role } });
    }

    if (action === 'remove_member') {
      const { companyUserId } = body;
      if (!companyUserId) return NextResponse.json({ error: 'companyUserId is required' }, { status: 400 });
      const target = await db.companyUser.findFirst({
        where: { id: companyUserId, companyId },
        include: { user: { select: { id: true } } },
      });
      if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
      if (target.user.id === payload.userId || ['company_owner', 'super_admin'].includes(target.role)) {
        return NextResponse.json({ error: 'This member cannot be removed here' }, { status: 403 });
      }
      if (!hasPermission(payload.role, 'company_owner') && target.role === 'admin') {
        return NextResponse.json({ error: 'Only an owner can remove another admin' }, { status: 403 });
      }

      await db.$transaction(async (tx) => {
        await tx.lead.updateMany({ where: { assignedToId: target.id, companyId }, data: { assignedToId: null } });
        await tx.ticket.updateMany({ where: { assignedToId: target.id, companyId }, data: { assignedToId: null } });
        await tx.companyUser.delete({ where: { id: target.id } });
      });
      await db.auditLog.create({
        data: {
          action: 'remove_member',
          resource: `Member: ${target.id}`,
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
      const existing = await db.invitation.findFirst({ where: { id: invitationId, companyId, acceptedAt: null } });
      if (!existing) return NextResponse.json({ error: 'Pending invitation not found' }, { status: 404 });

      const rawToken = createInvitationToken();
      const invitation = await db.invitation.update({
        where: { id: existing.id },
        data: { token: hashInvitationToken(rawToken), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60_000) },
        select: { id: true, email: true, role: true, expiresAt: true },
      });
      return NextResponse.json({ inviteUrl: inviteLink(rawToken), expiresAt: invitation.expiresAt.toISOString() });
    }

    if (action === 'revoke_invitation') {
      const { invitationId } = body;
      if (!invitationId) return NextResponse.json({ error: 'invitationId is required' }, { status: 400 });
      const invitation = await db.invitation.findFirst({ where: { id: invitationId, companyId, acceptedAt: null } });
      if (!invitation) return NextResponse.json({ error: 'Pending invitation not found' }, { status: 404 });
      await db.invitation.delete({ where: { id: invitationId } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown team action' }, { status: 400 });
  } catch (error) {
    console.error('[POST /api/team]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function prettyAction(action: string): string {
  const map: Record<string, string> = {
    invite: 'Created Invitation',
    update_role: 'Updated Role',
    remove_member: 'Removed Member',
    create: 'Created',
    update: 'Updated',
    delete: 'Deleted',
    login: 'Logged In',
    logout: 'Logged Out',
  };
  return map[action] || action.split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}
