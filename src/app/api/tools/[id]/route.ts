import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { encryptCredentialFields } from '@/lib/credentials';
import { hasPermission, verifyToken } from '@/lib/auth';

interface CredentialSpec {
  key: string;
  label?: string;
  isSecret?: boolean;
  optional?: boolean;
}

function parseCredentialSpecs(raw: string): CredentialSpec[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((field): field is CredentialSpec =>
      typeof field === 'object' && field !== null && typeof (field as CredentialSpec).key === 'string',
    ) : [];
  } catch {
    return [];
  }
}

function safeConnection(connection: any) {
  return {
    id: connection.id,
    status: connection.status === 'active' ? 'configured' : connection.status,
    connectedAt: connection.connectedAt?.toISOString?.() || null,
    lastSyncedAt: connection.lastSyncedAt?.toISOString?.() || null,
    lastError: connection.lastError,
    totalCalls: connection.totalCalls,
    errorCount: connection.errorCount,
    hasCredentials: Boolean(connection.credentials && connection.credentials !== '{}'),
  };
}

async function resolveTool(id: string) {
  const number = Number.parseInt(id, 10);
  return Number.isNaN(number)
    ? db.toolDefinition.findUnique({ where: { id } })
    : db.toolDefinition.findUnique({ where: { toolNumber: number } });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { id } = await params;
    const tool = await resolveTool(id);
    if (!tool) return NextResponse.json({ error: 'Tool not found' }, { status: 404 });
    const connections = await db.toolConnection.findMany({
      where: { companyId: payload.companyId, toolId: tool.id },
      select: { id: true, status: true, connectedAt: true, lastSyncedAt: true, lastError: true, totalCalls: true, errorCount: true, credentials: true },
    });
    return NextResponse.json({
      ...tool,
      requiredCredentials: parseCredentialSpecs(tool.requiredCredentials),
      connections: connections.map(safeConnection),
      liveProviderConnectionVerified: false,
    });
  } catch (error) {
    console.error('[GET /api/tools/[id]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    if (!hasPermission(payload.role, 'admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const tool = await resolveTool(id);
    if (!tool) return NextResponse.json({ error: 'Tool not found' }, { status: 404 });
    const result = await db.toolConnection.deleteMany({ where: { companyId: payload.companyId, toolId: tool.id } });
    return NextResponse.json({ success: true, removed: result.count });
  } catch (error) {
    console.error('[DELETE /api/tools/[id]]', error);
    return NextResponse.json({ error: 'Unable to remove tool configuration' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    if (!hasPermission(payload.role, 'admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const tool = await resolveTool(id);
    if (!tool) return NextResponse.json({ error: 'Tool not found' }, { status: 404 });
    const body = await req.json();
    if (body.status !== undefined && body.status !== 'configured') {
      return NextResponse.json({ error: 'Connection status is determined by provider verification; use DELETE to remove a configuration' }, { status: 400 });
    }

    const existing = await db.toolConnection.findFirst({ where: { companyId: payload.companyId, toolId: tool.id } });
    if (!existing) return NextResponse.json({ error: 'No configuration found' }, { status: 404 });
    if (!body.credentials || typeof body.credentials !== 'object' || Array.isArray(body.credentials)) {
      return NextResponse.json({ error: 'Resubmitting the full credential set is required' }, { status: 400 });
    }

    const specs = parseCredentialSpecs(tool.requiredCredentials);
    const supplied = body.credentials as Record<string, unknown>;
    const entries = Object.entries(supplied);
    if (entries.length > 50 || entries.some(([key, value]) => key.length > 120 || typeof value !== 'string' || value.length > 8192)) {
      return NextResponse.json({ error: 'Credential values exceed the allowed size or format' }, { status: 400 });
    }
    const allowedKeys = new Set(specs.filter((spec) => !spec.key.includes('*')).map((spec) => spec.key));
    if (entries.some(([key]) => !allowedKeys.has(key))) return NextResponse.json({ error: 'Unknown credential field supplied' }, { status: 400 });
    const missing = specs.find((spec) => !spec.optional && !spec.key.includes('*') &&
      (typeof supplied[spec.key] !== 'string' || !(supplied[spec.key] as string).trim()));
    if (missing) return NextResponse.json({ error: `Missing credential: ${missing.label || missing.key}` }, { status: 400 });
    const secretKeys = new Set(specs.filter((spec) => spec.isSecret).map((spec) => spec.key));

    let credentials: Record<string, string>;
    try {
      credentials = encryptCredentialFields(supplied, secretKeys);
    } catch {
      return NextResponse.json({ error: 'Credentials cannot be stored until CREDENTIAL_ENCRYPTION_KEY is configured' }, { status: 503 });
    }
    const serializedCredentials = JSON.stringify(credentials);
    if (Buffer.byteLength(serializedCredentials, 'utf8') > 32 * 1024) {
      return NextResponse.json({ error: 'Credential data exceeds the 32 KB limit' }, { status: 413 });
    }
    const connection = await db.toolConnection.update({
      where: { id: existing.id },
      data: { status: 'configured', connectedAt: null, credentials: serializedCredentials, config: '{}', lastError: 'Provider connection has not been verified' },
    });
    return NextResponse.json({ connection: safeConnection(connection), liveProviderConnectionVerified: false });
  } catch (error) {
    console.error('[PATCH /api/tools/[id]]', error);
    return NextResponse.json({ error: 'Unable to update tool configuration' }, { status: 500 });
  }
}
