import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { emitEvent } from '@/lib/events';
import { generateLocalVideo, generateLocalSpeech } from '@/lib/ai-provider';

// POST /api/ai/avatar-video — generate video with consistent avatar face + voice
// Body: { avatarId: string, script: string, duration?: number, platform?: string }
//
// This endpoint:
// 1. Loads the avatar profile (face image URL + voice ID)
// 2. Requests a self-hosted video adapter to use the avatar reference image
// 3. Generates audio using the same voice ID (keeps voice consistent)
// 4. Saves the result to Content table
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.companyId) return NextResponse.json({ error: 'Invalid' }, { status: 401 });

    const body = await req.json();
    const { avatarId, script } = body;
    if (!avatarId) return NextResponse.json({ error: 'avatarId required' }, { status: 400 });
    if (!script) return NextResponse.json({ error: 'script required (the narration text)' }, { status: 400 });

    const duration = Math.min(120, Math.max(5, body.duration || 15));

    // 1. Load the avatar profile
    const avatar = await db.aiAgent.findFirst({
      where: { id: String(avatarId), companyId: payload.companyId, type: 'avatar' },
    });
    if (!avatar) return NextResponse.json({ error: 'Avatar not found' }, { status: 404 });

    const config = (() => { try { return JSON.parse(avatar.config || '{}'); } catch { return {}; } })();
    const faceImageUrl = config.faceImageUrl;
    const voiceId = config.voiceId || 'default';

    // 2. Ask the configured self-hosted video adapter to use the avatar reference.
    // Actual reference-image conditioning depends on the adapter/model deployed by the operator.
    let videoTaskId: string | null = null;
    let videoStatus = 'unavailable';
    try {
      const videoResult = await generateLocalVideo(
        `A ${config.ethnicity || 'asian'} ${config.gender || 'female'} person presenting to camera, speaking naturally, professional marketing video style. Scene: ${script.slice(0, 500)}`,
        { duration, referenceImageUrl: faceImageUrl },
      );
      videoTaskId = videoResult.taskId;
      videoStatus = videoResult.status;
    } catch (err) {
      console.error('[avatar-video] local video service unavailable:', err instanceof Error ? err.message : 'unknown error');
    }

    // 3. Generate narration using a local TTS voice preset.
    let audioUrl: string | null = null;
    try {
      const ttsResult = await generateLocalSpeech(script, voiceId);
      audioUrl = ttsResult.audioUrl;
    } catch (err) {
      console.info('[avatar-video] local TTS unavailable:', err instanceof Error ? err.message : 'unknown error');
    }

    // 4. Save to Content table
    const content = await db.content.create({
      data: {
        title: `Avatar Video: ${avatar.name} — ${script.slice(0, 60)}`,
        type: 'video',
        status: 'draft',
        platform: body.platform || null,
        body: `# Avatar Video\n\n## Avatar\n${avatar.name} (${config.ethnicity || 'asian'} ${config.gender || 'female'})\n\n## Script\n${script}\n\n## Duration\n${duration} seconds\n\n## Voice ID\n${voiceId}\n\n## Video Task\n${videoTaskId || 'pending'}\n\n## Audio\n${audioUrl || 'embedded in video'}`,
        mediaUrl: audioUrl,
        mediaType: 'video',
        aiGenerated: true,
        creatorId: payload.userId,
        companyId: payload.companyId,
      },
    });

    // 5. Emit event
    await emitEvent({
      companyId: payload.companyId,
      userId: payload.userId,
      type: 'ai.avatar_video_created',
      title: `Avatar video created: ${avatar.name}`,
      description: `Script: "${script.slice(0, 60)}..." | Duration: ${duration}s | Voice: ${voiceId}`,
      resourceType: 'content',
      resourceId: content.id,
      link: '/content',
      metadata: {
        avatarName: avatar.name,
        voiceId,
        videoTaskId,
        videoStatus,
        duration,
        hasAudio: !!audioUrl,
      },
    });

    return NextResponse.json({
      data: {
        contentId: content.id,
        avatarName: avatar.name,
        avatarFace: faceImageUrl ? 'configured' : 'default',
        voiceId,
        script,
        duration,
        videoTaskId,
        videoStatus,
        audioUrl,
        message: videoStatus === 'unavailable'
          ? 'The content draft was saved, but local video generation is unavailable. Configure VIDEO_GENERATION_URL. TTS output is available only when TTS_SERVICE_URL is configured.'
          : 'Local video generation started. Use videoTaskId to check status via /api/ai/video-status?taskId=xxx',
      },
    }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/ai/avatar-video]', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
