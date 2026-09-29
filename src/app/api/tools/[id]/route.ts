import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

/** Resolve tool by either Prisma CUID id or numeric toolNumber */
async function resolveTool(id: string) {
  // Try numeric toolNumber first
  const num = parseInt(id, 10);
  if (!isNaN(num)) {
    return db.toolDefinition.findUnique({ where: { toolNumber: num } });
  }
  // Fall back to CUID
  return db.toolDefinition.findUnique({ where: { id } });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { id } = await params;
    const tool = await resolveTool(id);

    if (!tool) return NextResponse.json({ error: 'Tool not found' }, { status: 404 });

    const connections = await db.toolConnection.findMany({
      where: { companyId: payload.companyId, toolId: tool.id },
    });

    return NextResponse.json({
      ...tool,
      requiredCredentials: JSON.parse(tool.requiredCredentials),
      connections,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { id } = await params;
    const tool = await resolveTool(id);
    if (!tool) return NextResponse.json({ error: 'Tool not found' }, { status: 404 });

    await db.toolConnection.deleteMany({
      where: { companyId: payload.companyId, toolId: tool.id },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { id } = await params;
    const tool = await resolveTool(id);
    if (!tool) return NextResponse.json({ error: 'Tool not found' }, { status: 404 });

    const body = await req.json();
    const { credentials, config, status: connStatus } = body;

    const existing = await db.toolConnection.findFirst({
      where: { companyId: payload.companyId, toolId: tool.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'No connection found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (credentials) updateData.credentials = JSON.stringify(credentials);
    if (config) updateData.config = JSON.stringify(config);
    if (connStatus) {
      updateData.status = connStatus;
      if (connStatus === 'active') updateData.connectedAt = new Date();
      if (connStatus === 'error') updateData.errorCount = { increment: 1 };
    }

    const connection = await db.toolConnection.update({
      where: { id: existing.id },
      data: updateData,
    });

    return NextResponse.json({ connection, success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
