import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { generateVideo } from '@/lib/ai-extensions';
import { db } from '@/lib/db';
import { emitEvent } from '@/lib/events';
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.companyId) return NextResponse.json({ error: 'Invalid' }, { status: 401 });
    const body = await req.json();
    const prompt = String(body.prompt || '').trim();
    if (!prompt) return NextResponse.json({ error: 'prompt required' }, { status: 400 });
    const result = await generateVideo(prompt);
    if (!result) return NextResponse.json({ error: 'Video generation unavailable (rate-limited)' }, { status: 503 });
    if (body.saveToContent !== false) {
      await db.content.create({ data: { title: `AI Video: ${prompt.slice(0, 80)}`, type: 'video', status: 'draft', body: `Prompt: ${prompt}\nTask: ${result.taskId}`, mediaUrl: result.videoUrl || null, aiGenerated: true, creatorId: payload.userId, companyId: payload.companyId } });
    }
    await emitEvent({ companyId: payload.companyId, userId: payload.userId, type: 'ai.video_generated', title: 'AI video started', description: prompt.slice(0, 80), resourceType: 'content', metadata: { prompt, taskId: result.taskId } });
    return NextResponse.json({ data: { taskId: result.taskId, videoUrl: result.videoUrl, status: result.status, prompt } });
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}
