import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, hashPassword, ROLE_LABELS } from '@/lib/auth';

// GET /api/users — List users (admin+ only) with pagination + search
// Returns users in the current admin's company
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const adminRoles = ['super_admin', 'company_owner', 'admin', 'manager'];
    if (!adminRoles.includes(payload.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const skip = (page - 1) * limit;

    // List users via CompanyUser (company-scoped)
    const where: any = { companyId: payload.companyId };
    if (search) {
      where.OR = [
        { user: { name: { contains: search } } },
        { user: { email: { contains: search } } },
      ];
    }

    const [members, total] = await Promise.all([
      db.companyUser.findMany({
        where,
        skip,
        take: limit,
        orderBy: { joinedAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              phone: true,
              avatar: true,
              isActive: true,
              lastLoginAt: true,
              createdAt: true,
            },
          },
        },
      }),
      db.companyUser.count({ where }),
    ]);

    const users = members.map((m) => ({
      id: m.user.id,
      email: m.user.email,
      name: m.user.name,
      phone: m.user.phone,
      avatar: m.user.avatar,
      role: m.role,
      roleLabel: ROLE_LABELS[m.role] || m.role,
      isActive: m.user.isActive,
      lastLoginAt: m.user.lastLoginAt?.toISOString() || null,
      createdAt: m.user.createdAt.toISOString(),
      joinedAt: m.joinedAt.toISOString(),
    }));

    return NextResponse.json({
      data: users,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('[GET /api/users]', err);
    return NextResponse.json({ error: 'Failed to list users' }, { status: 500 });
  }
}

// POST /api/users — Admin creates a new user and links to their company
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const adminRoles = ['super_admin', 'company_owner', 'admin'];
    if (!adminRoles.includes(payload.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await req.json();
    const { name, email, password, role } = body;
    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
    }
    if (String(password).length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const existing = await db.user.findUnique({ where: { email: String(email) } });
    if (existing) {
      return NextResponse.json({ error: 'A user with that email already exists' }, { status: 409 });
    }

    const passwordHash = await hashPassword(String(password));
    const user = await db.user.create({
      data: {
        name: String(name),
        email: String(email),
        passwordHash,
        isActive: true,
      },
    });

    await db.companyUser.create({
      data: {
        userId: user.id,
        companyId: payload.companyId,
        role: role || 'team_member',
      },
    });

    return NextResponse.json({
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: role || 'team_member',
      },
    }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/users]', err);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
