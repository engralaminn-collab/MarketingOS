import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const companyId = payload.companyId;
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') || undefined;
    const automationLevel = searchParams.get('automationLevel') || undefined;
    const search = searchParams.get('search') || undefined;
    const status = searchParams.get('status') || undefined;
    const connectionStatus = searchParams.get('connectionStatus') || undefined;

    // Build where for tool definitions
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

    // Get tools with their connection status for this company
    const tools = await db.toolDefinition.findMany({
      where: toolWhere,
      include: {
        connections: {
          where: { companyId },
          select: {
            id: true,
            status: true,
            connectedAt: true,
            lastSyncedAt: true,
            lastError: true,
            totalCalls: true,
            errorCount: true,
          },
        },
      },
      orderBy: { toolNumber: 'asc' },
    });

    // Enrich with connection status
    const enriched = tools.map((tool) => {
      const conn = tool.connections[0];
      return {
        id: tool.id,
        toolNumber: tool.toolNumber,
        name: tool.name,
        url: tool.url,
        authType: tool.authType,
        requiredCredentials: JSON.parse(tool.requiredCredentials),
        connectionType: tool.connectionType,
        category: tool.category,
        subcategory: tool.subcategory,
        capabilities: tool.capabilities,
        automationLevel: tool.automationLevel,
        description: tool.description,
        icon: tool.icon,
        color: tool.color,
        connection: conn || null,
      };
    });

    // Get summary stats
    const allTools = await db.toolDefinition.findMany({
      where: { isEnabled: true },
      include: {
        connections: { where: { companyId }, select: { id: true, status: true } },
      },
    });

    const totalTools = allTools.length;
    const connectedCount = allTools.filter(
      (t) => t.connections.length > 0 && t.connections[0].status === 'active'
    ).length;
    const disconnectedCount = totalTools - connectedCount;

    // Category breakdown
    const categoryBreakdown: Record<string, { total: number; connected: number }> = {};
    for (const t of allTools) {
      if (!categoryBreakdown[t.category]) categoryBreakdown[t.category] = { total: 0, connected: 0 };
      categoryBreakdown[t.category].total++;
      if (t.connections.length > 0 && t.connections[0].status === 'active') {
        categoryBreakdown[t.category].connected++;
      }
    }

    // Automation level breakdown
    const automationBreakdown: Record<string, number> = {};
    for (const t of allTools) {
      const level = t.automationLevel;
      automationBreakdown[level] = (automationBreakdown[level] || 0) + 1;
    }

    return NextResponse.json({
      tools: enriched,
      total: totalTools,
      connected: connectedCount,
      disconnected: disconnectedCount,
      categoryBreakdown,
      automationBreakdown,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const companyId = payload.companyId;
    const body = await req.json();
    const { toolId, credentials, config } = body;

    if (!toolId) return NextResponse.json({ error: 'toolId is required' }, { status: 400 });

    // Verify tool exists
    const tool = await db.toolDefinition.findUnique({ where: { id: toolId } });
    if (!tool) return NextResponse.json({ error: 'Tool not found' }, { status: 404 });

    // Validate required credentials
    const requiredCreds = JSON.parse(tool.requiredCredentials);
    if (credentials) {
      for (const cred of requiredCreds) {
        if (!credentials[cred.key] && cred.key !== 'GOOGLE_*' && cred.key !== 'META_*' && cred.key !== 'REDDIT_*' && cred.key !== 'GOOGLE_ADS_*') {
          return NextResponse.json({ error: `Missing credential: ${cred.label}` }, { status: 400 });
        }
      }
    }

    // Upsert connection
    const connection = await db.toolConnection.upsert({
      where: { companyId_toolId: { companyId, toolId } },
      create: {
        companyId,
        toolId,
        status: 'active',
        connectedAt: new Date(),
        credentials: JSON.stringify(credentials || {}),
        config: JSON.stringify(config || {}),
      },
      update: {
        status: 'active',
        connectedAt: new Date(),
        credentials: JSON.stringify(credentials || {}),
        config: JSON.stringify(config || {}),
        lastError: null,
      },
    });

    // Update employee tools to include this tool reference
    await db.$executeRawUnsafe(
      `UPDATE "Employee" SET "tools" = "tools" || ? WHERE "companyId" = ? AND "tools" NOT LIKE ?`,
      `"${tool.id}"`,
      companyId,
      `"%${tool.id}%"`
    );

    return NextResponse.json({ connection, success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
