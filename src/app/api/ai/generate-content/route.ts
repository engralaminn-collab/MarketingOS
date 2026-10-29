import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hasPermission, verifyToken } from '@/lib/auth';
import { generateContentDraft } from '@/lib/agent-runtime';

// POST /api/ai/generate-content — generate a content draft via the Content Writer agent
// Body: { title: string, type: string, platform?: string, audience?: string, tone?: string, keyPoints?: string[] }
//   - If saveToDb=true (default), creates a Content row with status="draft" and returns its ID
//   - If saveToDb=false, just returns the generated text
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    if (!payload.userId || !hasPermission(payload.role, 'content_manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json();
    const title = String(body.title || '').trim();
    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    const result = await generateContentDraft(payload.companyId, payload.userId, {
      title,
      type: String(body.type || 'blog'),
      platform: body.platform,
      audience: body.audience,
      tone: body.tone,
      keyPoints: Array.isArray(body.keyPoints) ? body.keyPoints : undefined,
    });

    if (!result) {
      return NextResponse.json(
        { error: 'No enabled Content Writer agent found for your company. Enable one in AI Agents → Edit.' },
        { status: 404 },
      );
    }

    // Save as Content draft unless caller opted out
    let contentId: string | null = null;
    if (body.saveToDb !== false) {
      const content = await db.content.create({
        data: {
          title,
          type: String(body.type || 'blog'),
          status: 'draft',
          platform: body.platform || null,
          body: result.content,
          aiGenerated: true,
          creatorId: payload.userId,
          companyId: payload.companyId,
        },
      });
      contentId = content.id;
    }

    return NextResponse.json({
      data: {
        title,
        content: result.content,
        contentId,
        executionId: result.executionId,
        aiGenerated: true,
      },
    });
  } catch {
    console.error('[POST /api/ai/generate-content] failed');
    return NextResponse.json(
      { error: 'Failed to generate content' },
      { status: 500 },
    );
  }
}
