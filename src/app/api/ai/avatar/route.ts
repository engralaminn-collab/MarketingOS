import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hasPermission, verifyToken } from '@/lib/auth';
import { emitEvent } from '@/lib/events';
import { generateWithComfyUI } from '@/lib/comfyui';
import { generateFreeCloudImage } from '@/lib/ai-extensions';
import { generateLocalSpeech } from '@/lib/local-tts';

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.companyId) return NextResponse.json({ error: 'Invalid' }, { status: 401 });

    const avatars = await db.aiAgent.findMany({
      where: { companyId: payload.companyId, type: 'avatar' },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      data: avatars.map((a) => {
        const config = (() => {
          try {
            return JSON.parse(a.config || '{}');
          } catch {
            return {};
          }
        })();
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
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.companyId) return NextResponse.json({ error: 'Invalid' }, { status: 401 });
    if (!hasPermission(payload.role, 'content_manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const name = String(body.name || '').trim();
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

    const ethnicity = String(body.ethnicity || 'bangladeshi');
    const gender = String(body.gender || 'female');
    const age = String(body.age || 'young adult');
    const style = String(body.style || 'professional');
    const portraitPrompt = `Professional portrait photo of a ${age} ${ethnicity} ${gender} person, ${style} appearance, natural lighting, photorealistic, looking at camera, neutral background, head and shoulders shot`;

    let faceImageUrl: string | null = await generateWithComfyUI(portraitPrompt, 1024, 1024).catch(() => null);
    if (!faceImageUrl && body.provider === 'pollinations') {
      const free = await generateFreeCloudImage(portraitPrompt, 512, 512, 'pollinations').catch(() => null);
      faceImageUrl = free?.dataUrl || null;
    }

    const voiceId = String(body.voiceId || process.env.LOCAL_TTS_VOICE || 'default');
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

    let voiceTestUrl: string | null = null;
    try {
      const ttsResult = await generateLocalSpeech(
        `Hello, I am ${name}. I will be your presenter for marketing campaigns.`,
        voiceId,
      );
      voiceTestUrl = ttsResult?.audioDataUrl || null;
    } catch {
      // Optional TTS smoke test
    }

    await emitEvent({
      companyId: payload.companyId,
      userId: payload.userId,
      type: 'ai.avatar_created',
      title: `AI Avatar "${name}" created`,
      description: `${ethnicity} ${gender}, ${age}, ${style}.`,
      resourceType: 'avatar',
      resourceId: avatar.id,
      metadata: { name, ethnicity, gender, voiceId, hasFace: !!faceImageUrl, hasVoice: !!voiceTestUrl },
    });

    return NextResponse.json(
      {
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
          message: faceImageUrl
            ? 'Avatar profile created with rendered portrait.'
            : 'Avatar profile saved. Configure COMFYUI_BASE_URL or pass provider="pollinations" to generate portrait imagery.',
        },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('[POST /api/ai/avatar]', err);
    return NextResponse.json({ error: 'Failed to create avatar' }, { status: 500 });
  }
}
