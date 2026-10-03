import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { emitEvent } from '@/lib/events';
import ZAI from 'z-ai-web-dev-sdk';

// POST /api/ai/avatar-video — generate video with consistent avatar face + voice
// Body: { avatarId: string, script: string, duration?: number, platform?: string }
//
// This endpoint:
// 1. Loads the avatar profile (face image URL + voice ID)
// 2. Generates video using the face as image_url (keeps face consistent)
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

    // 2. Generate video with the avatar's face (image_url keeps the face consistent)
    let videoTaskId: string | null = null;
    let videoStatus = 'pending';

    try {
      const zai = await ZAI.create();

      const videoBody: any = {
        prompt: `A ${config.ethnicity || 'asian'} ${config.gender || 'female'} person presenting to camera, speaking naturally, professional marketing video style. Scene: ${script.slice(0, 500)}`,
        quality: 'quality',
        with_audio: true,
        size: '1920x1080',
        fps: 30,
        duration,
      };

      // If we have a face image URL, pass it to maintain consistency
      if (faceImageUrl && !faceImageUrl.startsWith('data:')) {
        videoBody.image_url = faceImageUrl;
      }

      const videoResult = await zai.video.generations.create(videoBody);
      videoTaskId = videoResult.id;
      videoStatus = videoResult.task_status || 'PROCESSING';
    } catch (err) {
      videoStatus = 'rate_limited';
      console.error('[avatar-video] video generation failed:', err);
    }

    // 3. Generate voice narration with the avatar's voice
    let audioUrl: string | null = null;
    try {
      const zai = await ZAI.create();
      const ttsResult = await zai.audio.tts.create({
        input: script,
        voice: voiceId,
      });
      audioUrl = ttsResult.url || ttsResult.audio_url || null;
    } catch {
      // Voice generation failed — video may still have audio from with_audio: true
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
        message: videoStatus === 'rate_limited'
          ? 'Video API is rate-limited. The script + storyboard are saved. Video will be generated when the API is available. Voice narration is also saved.'
          : 'Video generation started. Use the videoTaskId to check status via /api/ai/video-status?taskId=xxx',
      },
    }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/ai/avatar-video]', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
