import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { generateSpeech } from '@/lib/ai-extensions';
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid' }, { status: 401 });
    const body = await req.json();
    const text = String(body.text || '').trim();
    if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 });
    const result = await generateSpeech(text, body.voice || 'default');
    if (!result) return NextResponse.json({ error: 'Voice generation unavailable' }, { status: 503 });
    return NextResponse.json({ data: { audioUrl: result.audioUrl, text } });
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}
