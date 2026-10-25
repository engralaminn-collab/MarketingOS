import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hasPermission, verifyToken } from '@/lib/auth';
import { emitEvent } from '@/lib/events';
import { generateWithComfyUIVideo } from '@/lib/comfyui';
import { generateLocalSpeech } from '@/lib/local-tts';

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.companyId || !payload.userId) return NextResponse.json({ error: 'Invalid' }, { status: 401 });
    if (!hasPermission(payload.role, 'content_manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { avatarId, script } = body;
    if (!avatarId) return NextResponse.json({ error: 'avatarId required' }, { status: 400 });
    if (!script) return NextResponse.json({ error: 'script required (the narration text)' }, { status: 400 });

    const duration = Math.min(10, Math.max(3, Number(body.duration) || 5));

    const avatar = await db.aiAgent.findFirst({
      where: { id: String(avatarId), companyId: payload.companyId, type: 'avatar' },
    });
    if (!avatar) return NextResponse.json({ error: 'Avatar not found' }, { status: 404 });

    const config = (() => {
      try {
        return JSON.parse(avatar.config || '{}');
      } catch {
        return {};
      }
    })();
    const faceImageUrl = config.faceImageUrl || null;
    const voiceId = config.voiceId || 'default';

    let videoUrl: string | null = null;
    let videoStatus = 'draft-saved';
    try {
      videoUrl = await generateWithComfyUIVideo(
        `A ${config.ethnicity || 'asian'} ${config.gender || 'female'} presenter speaking naturally to camera. Scene: ${String(script).slice(0, 400)}`,
        duration,
      );
      if (videoUrl) videoStatus = 'completed';
    } catch {
      videoStatus = 'unavailable';
    }

    let audioUrl: string | null = null;
    try {
      const ttsResult = await generateLocalSpeech(String(script), voiceId);
      audioUrl = ttsResult?.audioDataUrl || null;
    } catch {
      // Optional local TTS
    }

    const content = await db.content.create({
      data: {
        title: `Avatar Video: ${avatar.name} — ${String(script).slice(0, 60)}`,
        type: 'video',
        status: 'draft',
        platform: typeof body.platform === 'string' ? body.platform : null,
        body: `# Avatar Video\n\n## Avatar\n${avatar.name}\n\n## Script\n${script}\n\n## Duration\n${duration}s\n\n## Voice ID\n${voiceId}\n\n## Render Status\n${videoStatus}`,
        mediaUrl: null,
        mediaType: 'video',
        aiGenerated: true,
        creatorId: payload.userId,
        companyId: payload.companyId,
      },
    });

    await emitEvent({
      companyId: payload.companyId,
      userId: payload.userId,
      type: 'ai.avatar_video_created',
      title: `Avatar video draft created: ${avatar.name}`,
      description: `Duration: ${duration}s | Voice: ${voiceId}`,
      resourceType: 'content',
      resourceId: content.id,
      link: '/content',
      metadata: { avatarName: avatar.name, voiceId, videoStatus, duration, hasAudio: !!audioUrl },
    });

    return NextResponse.json(
      {
        data: {
          contentId: content.id,
          avatarName: avatar.name,
          avatarFace: faceImageUrl ? 'configured' : 'default',
          voiceId,
          script,
          duration,
          videoUrl,
          videoStatus,
          audioUrl,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('[POST /api/ai/avatar-video]', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
