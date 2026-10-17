import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { humanizeText } from '@/lib/ai-extensions';

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const actor = await verifyToken(token);
    if (!actor?.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'A JSON object is required' }, { status: 400 });
    const input = body as Record<string, unknown>;
    const text = typeof input.text === 'string' ? input.text.trim() : '';
    if (!text || text.length > 10_000) return NextResponse.json({ error: 'Text is required and must be at most 10,000 characters' }, { status: 400 });
    const tone = ['casual', 'professional', 'friendly', 'persuasive'].includes(String(input.tone))
      ? input.tone as 'casual' | 'professional' | 'friendly' | 'persuasive'
      : 'casual';
    const result = await humanizeText(text, tone, actor.companyId);
    return NextResponse.json({ data: { original: text, humanized: result.text, tone, source: result.source, provider: result.provider } });
  } catch (error) {
    console.error('[POST /api/ai/humanize]', error);
    return NextResponse.json({ error: 'Could not humanize text' }, { status: 500 });
  }
}
