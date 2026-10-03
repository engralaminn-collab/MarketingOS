import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

// PATCH /api/campaigns/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { id } = await params;
    const data = await req.json();

    const existing = await db.campaign.findFirst({ where: { id, companyId: payload.companyId } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const update: any = {};
    const allowedFields = ['name', 'type', 'status', 'budget', 'startDate', 'endDate', 'metrics'];
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        if (field === 'budget') {
          update[field] = Number(data[field]);
        } else if (field === 'startDate' || field === 'endDate') {
          update[field] = data[field] ? new Date(data[field]) : null;
        } else if (field === 'metrics') {
          update[field] = JSON.stringify(data[field]);
        } else {
          update[field] = data[field];
        }
      }
    }

    const campaign = await db.campaign.update({
      where: { id },
      data: update,
      include: { contents: true },
    });
    return NextResponse.json({ campaign });
  } catch (err) {
    console.error('[PATCH /api/campaigns/[id]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/campaigns/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { id } = await params;
    const existing = await db.campaign.findFirst({ where: { id, companyId: payload.companyId } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Unlink contents before deleting
    await db.content.updateMany({ where: { campaignId: id }, data: { campaignId: null } });
    await db.campaign.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/campaigns/[id]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
