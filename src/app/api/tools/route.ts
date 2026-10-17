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
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((field): field is CredentialSpec =>
      typeof field === 'object' && field !== null && typeof (field as CredentialSpec).key === 'string',
    );
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

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') || undefined;
    const automationLevel = searchParams.get('automationLevel') || undefined;
    const search = searchParams.get('search') || undefined;
    const toolWhere: Record<string, unknown> = { isEnabled: true };
    if (category && category !== 'all') toolWhere.category = category;
    if (automationLevel && automationLevel !== 'all') toolWhere.automationLevel = automationLevel;
    if (search) {
      toolWhere.OR = [
        { name: { contains: search } },
        { capabilities: { contains: search } },
        { category: { contains: search } },
      ];
    }

    const tools = await db.toolDefinition.findMany({
      where: toolWhere,
      include: {
        connections: {
          where: { companyId: payload.companyId },
          select: {
            id: true,
            status: true,
            connectedAt: true,
            lastSyncedAt: true,
            lastError: true,
            totalCalls: true,
            errorCount: true,
            credentials: true,
          },
        },
      },
      orderBy: { toolNumber: 'asc' },
    });

    const enriched = tools.map((tool) => {
      const connection = tool.connections[0];
      return {
        id: tool.id,
        toolNumber: tool.toolNumber,
        name: tool.name,
        url: tool.url,
        authType: tool.authType,
        requiredCredentials: parseCredentialSpecs(tool.requiredCredentials),
        connectionType: tool.connectionType,
        category: tool.category,
        subcategory: tool.subcategory,
        capabilities: tool.capabilities,
        automationLevel: tool.automationLevel,
        description: tool.description,
        icon: tool.icon,
        color: tool.color,
        connection: connection ? safeConnection(connection) : null,
      };
    });

    const allTools = await db.toolDefinition.findMany({
      where: { isEnabled: true },
      include: { connections: { where: { companyId: payload.companyId }, select: { status: true } } },
    });
    const total = allTools.length;
    const isConfigured = (status: string) => ['configured', 'active', 'error'].includes(status);
    const configuredCount = allTools.filter((tool) => isConfigured(tool.connections[0]?.status || '')).length;
    const categoryBreakdown: Record<string, { total: number; configured: number }> = {};
    const automationBreakdown: Record<string, number> = {};
    for (const tool of allTools) {
      categoryBreakdown[tool.category] ||= { total: 0, configured: 0 };
      categoryBreakdown[tool.category].total++;
      if (isConfigured(tool.connections[0]?.status || '')) categoryBreakdown[tool.category].configured++;
      automationBreakdown[tool.automationLevel] = (automationBreakdown[tool.automationLevel] || 0) + 1;
    }

    return NextResponse.json({
      tools: enriched,
      total,
      configured: configuredCount,
      connected: 0,
      disconnected: total - configuredCount,
      categoryBreakdown,
      automationBreakdown,
      liveProviderConnectionsVerified: false,
    });
  } catch (error) {
    console.error('[GET /api/tools]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    if (!hasPermission(payload.role, 'admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const toolId = typeof body?.toolId === 'string' ? body.toolId : '';
    if (!toolId) return NextResponse.json({ error: 'toolId is required' }, { status: 400 });
    if (!body.credentials || typeof body.credentials !== 'object' || Array.isArray(body.credentials)) {
      return NextResponse.json({ error: 'credentials must be an object' }, { status: 400 });
    }

    const tool = await db.toolDefinition.findUnique({ where: { id: toolId } });
    if (!tool || !tool.isEnabled) return NextResponse.json({ error: 'Tool not found' }, { status: 404 });
    const specs = parseCredentialSpecs(tool.requiredCredentials);
    const supplied = body.credentials as Record<string, unknown>;
    const entries = Object.entries(supplied);
    if (entries.length > 50 || entries.some(([key, value]) => key.length > 120 || typeof value !== 'string' || value.length > 8192)) {
      return NextResponse.json({ error: 'Credential values exceed the allowed size or format' }, { status: 400 });
    }

    const missing = specs.find((spec) => !spec.optional && !spec.key.includes('*') &&
      (typeof supplied[spec.key] !== 'string' || !(supplied[spec.key] as string).trim()));
    if (missing) return NextResponse.json({ error: `Missing credential: ${missing.label || missing.key}` }, { status: 400 });

    const allowedKeys = new Set(specs.filter((spec) => !spec.key.includes('*')).map((spec) => spec.key));
    if (entries.some(([key]) => !allowedKeys.has(key))) {
      return NextResponse.json({ error: 'Unknown credential field supplied' }, { status: 400 });
    }
    const secretKeys = new Set(specs.filter((spec) => spec.isSecret).map((spec) => spec.key));
    let credentials: Record<string, string>;
    try {
      credentials = encryptCredentialFields(supplied, secretKeys);
    } catch (error) {
      console.error('[POST /api/tools] credential encryption unavailable:', error);
      return NextResponse.json({ error: 'Credentials cannot be stored until CREDENTIAL_ENCRYPTION_KEY is configured' }, { status: 503 });
    }
    const serializedCredentials = JSON.stringify(credentials);
    if (Buffer.byteLength(serializedCredentials, 'utf8') > 32 * 1024) {
      return NextResponse.json({ error: 'Credential data exceeds the 32 KB limit' }, { status: 413 });
    }

    const connection = await db.toolConnection.upsert({
      where: { companyId_toolId: { companyId: payload.companyId, toolId } },
      create: {
        companyId: payload.companyId,
        toolId,
        status: 'configured',
        connectedAt: null,
        credentials: serializedCredentials,
        config: '{}',
      },
      update: {
        status: 'configured',
        connectedAt: null,
        credentials: serializedCredentials,
        config: '{}',
        lastError: 'Provider connection has not been verified',
      },
    });

    return NextResponse.json({
      connection: safeConnection(connection),
      success: true,
      liveProviderConnectionVerified: false,
      message: 'Credentials stored encrypted; no live provider connection was tested.',
    }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/tools]', error);
    return NextResponse.json({ error: 'Unable to store tool credentials' }, { status: 500 });
  }
}
