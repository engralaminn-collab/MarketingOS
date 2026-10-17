import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hasPermission, verifyToken } from '@/lib/auth';

// GET /api/settings/company
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const company = await db.company.findUnique({ where: { id: payload.companyId } });
    if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 });

    let brandColors: { primary?: string; secondary?: string; accent?: string } = {};
    try {
      brandColors = JSON.parse(company.brandColors || '{}');
    } catch { /* skip */ }

    return NextResponse.json({
      company: {
        id: company.id,
        name: company.name,
        website: company.website || '',
        industry: company.industry || '',
        country: company.country || '',
        primaryColor: brandColors.primary || '#f97316',
        secondaryColor: brandColors.secondary || '#3b82f6',
        accentColor: brandColors.accent || '#10b981',
        targetAudience: company.targetAudience || '',
        marketingGoals: company.marketingGoals || '',
        plan: company.plan,
      },
    });
  } catch (err) {
    console.error('[GET /api/settings/company]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/settings/company
export async function PUT(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    if (!hasPermission(payload.role, 'admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const data = await req.json();
    const update: any = {};
    if (data.name !== undefined) update.name = String(data.name);
    if (data.website !== undefined) update.website = String(data.website);
    if (data.industry !== undefined) update.industry = String(data.industry);
    if (data.country !== undefined) update.country = String(data.country);
    if (data.targetAudience !== undefined) update.targetAudience = String(data.targetAudience);
    if (data.marketingGoals !== undefined) update.marketingGoals = String(data.marketingGoals);

    if (data.primaryColor || data.secondaryColor || data.accentColor) {
      const existing = await db.company.findUnique({ where: { id: payload.companyId } });
      let brandColors: any = {};
      try { brandColors = JSON.parse(existing?.brandColors || '{}'); } catch { /* skip */ }
      if (data.primaryColor) brandColors.primary = data.primaryColor;
      if (data.secondaryColor) brandColors.secondary = data.secondaryColor;
      if (data.accentColor) brandColors.accent = data.accentColor;
      update.brandColors = JSON.stringify(brandColors);
    }

    const company = await db.company.update({ where: { id: payload.companyId }, data: update });

    await db.auditLog.create({
      data: {
        action: 'update',
        resource: 'Company Settings',
        details: `Updated company settings (${Object.keys(update).join(', ')})`,
        userId: payload.userId,
        companyId: payload.companyId,
      },
    });

    return NextResponse.json({ company });
  } catch (err) {
    console.error('[PUT /api/settings/company]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
