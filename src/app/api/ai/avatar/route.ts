import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hasPermission, verifyToken } from '@/lib/auth';
import { emitEvent } from '@/lib/events';
import { generateLocalImage, generateLocalSpeech } from '@/lib/ai-provider';

// GET /api/ai/avatar — list all avatar profiles
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.companyId) return NextResponse.json({ error: 'Invalid' }, { status: 401 });

    // Avatar profiles are stored as AiAgent records with type 'avatar'
    const avatars = await db.aiAgent.findMany({
      where: { companyId: payload.companyId, type: 'avatar' },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      data: avatars.map(a => {
        const config = (() => { try { return JSON.parse(a.config || '{}'); } catch { return {}; } })();
        return {
          id: a.id,
          name: a.name,
          description: a.description,
          faceImageUrl: config.faceImageUrl || null,
          voiceId: config.voiceId || 'default',
          ethnicity: config.ethnicity || 'asian',
          gender: config.gender || 'female',
          age: config.age || 'young adult',
          style: config.style || 'professional',
          isEnabled: a.isEnabled,
          createdAt: a.createdAt.toISOString(),
        };
      }),
    });
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}

// POST /api/ai/avatar — create a new AI avatar with consistent face + voice
// Body: { name, ethnicity?, gender?, age?, style?, description? }
// Generates a face image locally and selects a local TTS voice preset
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.companyId) return NextResponse.json({ error: 'Invalid' }, { status: 401 });
    if (!hasPermission(payload.role, 'content_manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (process.env.ZAI_MEDIA_ENABLED !== 'true') {
      return NextResponse.json({ error: 'Hosted avatar generation is disabled. Configure a local media model or explicitly enable ZAI_MEDIA_ENABLED.' }, { status: 503 });
    }

    const body = await req.json();
    const name = String(body.name || '').trim();
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

    const ethnicity = body.ethnicity || 'bangladeshi';
    const gender = body.gender || 'female';
    const age = body.age || 'young adult';
    const style = body.style || 'professional';

    // Generate the face with the local Stable Diffusion service. Do not substitute
    // a stock avatar when real image generation is unavailable.
    let faceImageUrl: string;
    try {
      const imageResult = await generateLocalImage(
        `Professional portrait photo of a ${age} ${ethnicity} ${gender} person, ${style} appearance, natural lighting, photorealistic, looking at camera, neutral background, head and shoulders shot`,
        '1024x1024',
      );
      faceImageUrl = imageResult.dataUrl;
    } catch (error) {
      console.error('[avatar] local image service unavailable:', error instanceof Error ? error.message : 'unknown error');
      return NextResponse.json({ error: 'Local avatar image generation is unavailable. Configure IMAGE_GENERATION_URL. No cloud fallback was attempted.' }, { status: 503 });
    }

    // This selects a configured TTS voice preset; it does not clone a voice.
    const voiceId = String(body.voiceId || process.env.TTS_DEFAULT_VOICE || 'default');

    // Store the avatar profile as an AiAgent record
    const avatar = await db.aiAgent.create({
      data: {
        name,
        type: 'avatar',
        description: body.description || `${ethnicity} ${gender} avatar, ${age}, ${style}`,
        config: JSON.stringify({
          faceImageUrl,
          voiceId,
          ethnicity,
          gender,
          age,
          style,
          createdAt: new Date().toISOString(),
        }),
        isEnabled: true,
        companyId: payload.companyId,
      },
    });

    // Optional local TTS smoke test. The avatar can exist without a configured TTS service.
    let voiceTestUrl: string | null = null;
    try {
      const ttsResult = await generateLocalSpeech(`Hello, I am ${name}. I will be your AI presenter for marketing videos.`, voiceId);
      voiceTestUrl = ttsResult.audioUrl;
    } catch (error) {
      console.info('[avatar] local TTS not configured:', error instanceof Error ? error.message : 'unknown error');
    }

    await emitEvent({
      companyId: payload.companyId,
      userId: payload.userId,
      type: 'ai.avatar_created',
      title: `AI Avatar "${name}" created`,
      description: `${ethnicity} ${gender}, ${age}, ${style}. Local face generated; selected TTS voice preset.`,
      resourceType: 'avatar',
      resourceId: avatar.id,
      metadata: { name, ethnicity, gender, voiceId, hasVoice: !!voiceTestUrl },
    });

    return NextResponse.json({
      data: {
        id: avatar.id,
        name,
        ethnicity,
        gender,
        age,
        style,
        faceImageUrl,
        voiceId,
        voiceTestUrl,
        message: 'Avatar profile created using local image generation. Video and TTS services must be configured separately.',
      },
    }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/ai/avatar]', err);
    return NextResponse.json({ error: 'Failed to create avatar' }, { status: 500 });
  }
}
