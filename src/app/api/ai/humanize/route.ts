import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { humanizeText } from '@/lib/ai-extensions';
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    const body = await req.json();
    const text = String(body.text || '').trim();
    if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 });
    const tone = ['casual', 'professional', 'friendly', 'persuasive'].includes(body.tone) ? body.tone : 'casual';
    const humanized = await humanizeText(text, tone as any);
    return NextResponse.json({ data: { original: text, humanized, tone } });
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}
