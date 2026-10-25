import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { humanizeText } from '@/lib/ai-extensions';

const ALLOWED_TONES = new Set(['natural', 'conversational', 'executive', 'academic', 'friendly', 'concise']);

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const actor = await verifyToken(token);
    if (!actor?.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'A JSON object is required' }, { status: 400 });
    }
    const input = body as Record<string, unknown>;
    const text = typeof input.text === 'string' ? input.text.trim() : '';
    if (!text || text.length > 12_000) {
      return NextResponse.json({ error: 'Text is required and must be at most 12,000 characters' }, { status: 400 });
    }
    const tone = typeof input.tone === 'string' && ALLOWED_TONES.has(input.tone) ? input.tone : 'natural';
    const result = await humanizeText(text, tone);

    return NextResponse.json(
      {
        data: {
          originalText: text,
          humanizedText: result.text,
          tone,
          degraded: result.degraded,
          aiScoreBefore: result.aiScoreBefore,
          aiScoreAfter: result.aiScoreAfter,
          detectedTells: result.detectedTells,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[POST /api/ai/humanize]', error);
    return NextResponse.json({ error: 'Could not humanize text' }, { status: 500 });
  }
}
